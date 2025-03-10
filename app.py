from flask import Flask, request, jsonify, render_template, send_from_directory
import os
from pathlib import Path
import librosa
import soundfile as sf
import numpy as np
from scipy import signal
import warnings
import pyloudnorm as pyln
import torch
import torchaudio
import librosa.display
import logging
from werkzeug.utils import secure_filename
from pydub import AudioSegment
import tempfile
from config import config

warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(config['development'])

# Create necessary folders
for folder in [app.config['UPLOAD_FOLDER'], app.config['PROCESSED_FOLDER']]:
    folder.mkdir(exist_ok=True)

# Define base directory and folders
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_FOLDER = BASE_DIR / 'uploads'
PROCESSED_FOLDER = BASE_DIR / 'processed'
STATIC_FOLDER = BASE_DIR / 'static'
TEMPLATES_FOLDER = BASE_DIR / 'templates'

# Configure Flask app
app.config.update(
    UPLOAD_FOLDER=str(UPLOAD_FOLDER),
    PROCESSED_FOLDER=str(PROCESSED_FOLDER),
    STATIC_FOLDER=str(STATIC_FOLDER),
    TEMPLATE_FOLDER=str(TEMPLATES_FOLDER),
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,  # 16MB max file size
    SEND_FILE_MAX_AGE_DEFAULT=0,  # Prevent caching
)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg', 'weba', 'm4a', 'webm'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    try:
        # Check file size
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        
        if size > app.config['MAX_CONTENT_LENGTH']:
            return jsonify({'error': f'File too large. Maximum size is {app.config["MAX_CONTENT_LENGTH"] // (1024*1024)}MB'}), 400
            
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # If file exists, add number to filename
        base, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(file_path):
            filename = f"{base}_{counter}{ext}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            counter += 1
            
        # Ensure upload directory exists
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        
        # Save the file
        file.save(file_path)
        
        logger.info(f"File uploaded successfully: {filename}")
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': filename,
            'file_path': filename
        }), 200
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        return jsonify({'error': str(e)}), 500

def convert_to_wav(input_path):
    """Convert any audio format to WAV for processing"""
    try:
        # Create a temporary WAV file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_wav:
            # Load audio using pydub (supports many formats)
            audio = AudioSegment.from_file(input_path)
            audio.export(temp_wav.name, format='wav')
            return temp_wav.name
    except Exception as e:
        logger.error(f"Error converting audio: {str(e)}")
        return None

def save_processed_audio(audio_data, sr, output_path):
    """Save processed audio in the original format"""
    try:
        # First save as WAV
        temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        sf.write(temp_wav.name, audio_data, sr)
        
        # Get output format
        output_format = output_path.split('.')[-1].lower()
        
        # Map formats to pydub formats
        format_map = {
            'weba': 'webm',
            'webm': 'webm',
            'mp3': 'mp3',
            'wav': 'wav',
            'ogg': 'ogg',
            'm4a': 'mp4'
        }
        
        export_format = format_map.get(output_format, 'wav')
        
        # Convert to target format using pydub
        audio = AudioSegment.from_wav(temp_wav.name)
        audio.export(output_path, format=export_format)
        
        # Clean up temp file
        os.unlink(temp_wav.name)
        return True
    except Exception as e:
        logger.error(f"Error saving audio: {str(e)}")
        if os.path.exists(temp_wav.name):
            os.unlink(temp_wav.name)
        return False

def process_audio(input_path, output_path, speed=1.0, pitch=0):
    try:
        # Convert to WAV for processing
        wav_path = convert_to_wav(input_path)
        if not wav_path:
            return False
            
        # Load and process
        y, sr = librosa.load(wav_path)
        
        if speed != 1.0:
            y = librosa.effects.time_stretch(y, rate=speed)
        
        if pitch != 0:
            y = librosa.effects.pitch_shift(y, sr=sr, n_steps=pitch)
        
        # Save in original format
        success = save_processed_audio(y, sr, output_path)
        
        # Clean up
        os.unlink(wav_path)
        return success
    except Exception as e:
        logger.error(f"Error processing audio: {str(e)}")
        return False

def reduce_noise_from_audio(input_path, output_path):
    try:
        # Convert to WAV for processing
        wav_path = convert_to_wav(input_path)
        if not wav_path:
            return False
            
        y, sr = librosa.load(wav_path)
        
        # Noise reduction processing
        S = librosa.stft(y)
        mag = np.abs(S)
        noise_mag = np.mean(mag[:, :10], axis=1, keepdims=True)
        mag = np.maximum(mag - noise_mag, 0)
        reduced = mag * np.exp(1.j * np.angle(S))
        y_reduced = librosa.istft(reduced)
        
        # Save in original format
        success = save_processed_audio(y_reduced, sr, output_path)
        
        # Clean up
        os.unlink(wav_path)
        return success
    except Exception as e:
        logger.error(f"Error reducing noise: {str(e)}")
        return False

def apply_equalizer(y, sr, bass=0, mid=0, treble=0):
    # Create three band equalizer
    y_harmonic, y_percussive = librosa.effects.hpss(y)
    
    # Adjust bass (0-100 Hz)
    bass_multiplier = np.exp(bass / 20)
    y_bass = librosa.effects.preemphasis(y_harmonic, coef=0.95, zi=None)
    y_bass *= bass_multiplier
    
    # Adjust mid (100-2000 Hz)
    mid_multiplier = np.exp(mid / 20)
    y_mid = librosa.effects.preemphasis(y_harmonic, coef=0.75, zi=None)
    y_mid *= mid_multiplier
    
    # Adjust treble (2000+ Hz)
    treble_multiplier = np.exp(treble / 20)
    y_treble = librosa.effects.preemphasis(y_harmonic, coef=0.55, zi=None)
    y_treble *= treble_multiplier
    
    return y_bass + y_mid + y_treble + y_percussive

def apply_reverb(y, sr, room_size=0.5, damping=0.5):
    # Create reverb effect using convolution
    reverb_len = int(sr * room_size)
    decay = np.exp(-damping * np.linspace(0, room_size, reverb_len))
    impulse_response = np.random.randn(reverb_len) * decay
    y_reverb = signal.convolve(y, impulse_response, mode='full')[:len(y)]
    return y_reverb

def apply_compression(y, sr, threshold_db=-20, ratio=4):
    # Dynamic range compression
    meter = pyln.Meter(sr) # create BS.1770 meter
    loudness = meter.integrated_loudness(y)
    
    # Calculate gain reduction
    threshold = 10 ** (threshold_db / 20)
    gain_reduction = np.where(np.abs(y) > threshold,
                            (np.abs(y) / threshold) ** (1/ratio - 1),
                            1.0)
    
    return y * gain_reduction

def separate_vocals_from_audio(input_path, output_path_vocals, output_path_instrumental):
    try:
        # Load the audio file
        y, sr = librosa.load(input_path)
        
        # Compute the spectrogram
        S_full, phase = librosa.magphase(librosa.stft(y))
        
        # Compute soft mask
        S_filter = librosa.decompose.nn_filter(S_full,
                                             aggregate=np.median,
                                             metric='cosine',
                                             width=int(librosa.time_to_frames(2, sr=sr)))
        S_filter = np.minimum(S_full, S_filter)
        margin_v = 2
        power = 2
        mask_v = librosa.util.softmask(S_full - S_filter,
                                     margin_v * S_filter,
                                     power=power)
        
        # Get vocals and background
        S_foreground = mask_v * S_full
        S_background = (1 - mask_v) * S_full
        
        # Save separated audio
        y_foreground = librosa.istft(S_foreground * phase)
        y_background = librosa.istft(S_background * phase)
        
        sf.write(output_path_vocals, y_foreground, sr)
        sf.write(output_path_instrumental, y_background, sr)
        return True
    except Exception as e:
        print(f"Error separating vocals: {str(e)}")
        return False

def analyze_audio(input_path):
    try:
        y, sr = librosa.load(input_path)
        
        # Detect tempo
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        
        # Detect key
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        key_labels = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key_index = int(np.mean(np.argmax(chroma, axis=0)))
        key = key_labels[key_index]
        
        # Get average loudness
        loudness = librosa.feature.rms(y=y)
        avg_loudness = float(np.mean(loudness))
        
        return {
            'tempo': float(tempo),
            'key': key,
            'loudness': avg_loudness
        }
    except Exception as e:
        print(f"Error analyzing audio: {str(e)}")
        return None

def apply_style_transfer(input_path, style, output_path):
    try:
        # Convert to WAV for processing
        wav_path = convert_to_wav(input_path)
        if not wav_path:
            return False
            
        # Load and process audio
        y, sr = librosa.load(wav_path)
        
        if style == 'warm':
            # Add warmth by boosting low-mids
            y_processed = apply_equalizer(y, sr, bass=3, mid=2, treble=-1)
        elif style == 'bright':
            # Add brightness by boosting highs
            y_processed = apply_equalizer(y, sr, bass=0, mid=1, treble=4)
        elif style == 'vintage':
            # Add vintage effect with mild distortion and filtering
            y_processed = apply_equalizer(y, sr, bass=2, mid=-1, treble=-2)
            y_processed = apply_reverb(y_processed, sr, room_size=0.3, damping=0.7)
        
        # Save processed audio
        success = save_processed_audio(y_processed, sr, output_path)
        
        # Clean up
        os.unlink(wav_path)
        return success
    except Exception as e:
        logger.error(f"Error applying style transfer: {str(e)}")
        return False

@app.route('/modify', methods=['POST'])
def modify_audio():
    data = request.json
    filename = data.get('filename')
    speed = float(data.get('speed', 1.0))
    pitch = int(data.get('pitch', 0))
    
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
        
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    output_path = os.path.join(app.config['PROCESSED_FOLDER'], f'modified_{filename}')
    
    if process_audio(input_path, output_path, speed, pitch):
        return jsonify({
            'message': 'Audio modified successfully',
            'modified_file': f'modified_{filename}'
        }), 200
    else:
        return jsonify({'error': 'Failed to process audio'}), 500

@app.route('/separate', methods=['POST'])
def separate_vocals():
    data = request.json
    filename = data.get('filename')
    
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
    
    try:
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        output_path_vocals = os.path.join(app.config['PROCESSED_FOLDER'], f'vocals_{filename}')
        output_path_instrumental = os.path.join(app.config['PROCESSED_FOLDER'], f'instrumental_{filename}')
        
        if separate_vocals_from_audio(input_path, output_path_vocals, output_path_instrumental):
            return jsonify({
                'message': 'Vocals separated successfully',
                'vocals_file': f'vocals_{filename}',
                'instrumental_file': f'instrumental_{filename}'
            }), 200
        else:
            return jsonify({'error': 'Failed to separate vocals'}), 500
    except Exception as e:
        print(f"Error separating vocals: {str(e)}")
        return jsonify({'error': 'Failed to separate vocals'}), 500

@app.route('/reduce_noise', methods=['POST'])
def reduce_noise():
    data = request.json
    filename = data.get('filename')
    
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
        
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    output_path = os.path.join(app.config['PROCESSED_FOLDER'], f'noise_reduced_{filename}')
    
    if reduce_noise_from_audio(input_path, output_path):
        return jsonify({
            'message': 'Noise reduction completed',
            'processed_file': f'noise_reduced_{filename}'
        }), 200
    else:
        return jsonify({'error': 'Failed to reduce noise'}), 500

@app.route('/eq', methods=['POST'])
def equalizer():
    data = request.json
    filename = data.get('filename')
    bass = float(data.get('bass', 0))
    mid = float(data.get('mid', 0))
    treble = float(data.get('treble', 0))
    
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
        
    try:
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        output_path = os.path.join(app.config['PROCESSED_FOLDER'], f'eq_{filename}')
        
        y, sr = librosa.load(input_path)
        y_eq = apply_equalizer(y, sr, bass, mid, treble)
        sf.write(output_path, y_eq, sr)
        
        return jsonify({
            'message': 'Equalizer applied successfully',
            'processed_file': f'eq_{filename}'
        }), 200
    except Exception as e:
        print(f"Error applying equalizer: {str(e)}")
        return jsonify({'error': 'Failed to apply equalizer'}), 500

@app.route('/reverb', methods=['POST'])
def reverb():
    data = request.json
    filename = data.get('filename')
    room_size = float(data.get('room_size', 0.5))
    damping = float(data.get('damping', 0.5))
    
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
        
    try:
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        output_path = os.path.join(app.config['PROCESSED_FOLDER'], f'reverb_{filename}')
        
        y, sr = librosa.load(input_path)
        y_reverb = apply_reverb(y, sr, room_size, damping)
        sf.write(output_path, y_reverb, sr)
        
        return jsonify({
            'message': 'Reverb applied successfully',
            'processed_file': f'reverb_{filename}'
        }), 200
    except Exception as e:
        print(f"Error applying reverb: {str(e)}")
        return jsonify({'error': 'Failed to apply reverb'}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    data = request.json
    filename = data.get('filename')
    
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
        
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    analysis = analyze_audio(input_path)
    
    if analysis:
        return jsonify({
            'message': 'Audio analyzed successfully',
            'analysis': analysis
        }), 200
    else:
        return jsonify({'error': 'Failed to analyze audio'}), 500

@app.route('/style_transfer', methods=['POST'])
def style_transfer():
    data = request.json
    filename = data.get('filename')
    style = data.get('style', 'warm')
    
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
        
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    output_path = os.path.join(app.config['PROCESSED_FOLDER'], f'style_{style}_{filename}')
    
    if apply_style_transfer(input_path, style, output_path):
        return jsonify({
            'message': f'Style transfer ({style}) applied successfully',
            'processed_file': f'style_{style}_{filename}'
        }), 200
    else:
        return jsonify({'error': 'Failed to apply style transfer'}), 500

@app.route('/processed/<filename>')
def processed_file(filename):
    return send_from_directory(app.config['PROCESSED_FOLDER'], filename, as_attachment=True)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

@app.route('/demo')
def demo():
    return send_from_directory(app.config['STATIC_FOLDER'], 'demo.html')

if __name__ == '__main__':
    logger.info("Starting server...")
    logger.info(f"Upload folder: {UPLOAD_FOLDER}")
    logger.info(f"Processed folder: {PROCESSED_FOLDER}")
    
    # Add extra configuration for development server
    app.config['TEMPLATES_AUTO_RELOAD'] = True
    app.jinja_env.auto_reload = True
    
    app.run(
        debug=True,
        use_reloader=True,
        reloader_type='stat'  # Use stat reloader instead of watchdog
    )