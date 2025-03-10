# AI Song Modification Tool

A web-based application for modifying and processing audio files using AI and signal processing techniques.

## Features

- Audio file upload and processing
- Real-time waveform visualization
- Basic audio controls (speed, pitch)
- Effects (reverb, EQ, compression)
- AI-powered analysis and style transfer
- Vocal separation
- Noise reduction

## Getting Started

### Prerequisites
- Python 3.8 or higher
- FFmpeg installed on your system
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/song-modification-tool.git
cd song-modification-tool
```

2. Create a virtual environment and activate it:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the server:
```bash
flask run
```

## GitHub Setup

After installing Git, run these commands in Git Bash:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/abdulraheemnohri/song-modification-tool.git
git push -u origin main
```

### GitHub Repository
```bash
https://github.com/abdulraheemnohri/song-modification-tool
```

### Author
- Abdul Raheem (abdulraheemnohri@gmail.com)

## Usage

1. Open your browser and go to `http://localhost:5000`
2. Upload an audio file
3. Use the various tools to modify your audio
4. Download the processed file

## Development

For development, install additional dependencies:
```bash
pip install -r requirements-dev.txt
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Project Structure
```
song-modification-tool/
├── app.py              # Main application file
├── config.py           # Configuration settings
├── requirements.txt    # Production dependencies
├── requirements-dev.txt# Development dependencies
├── static/            # Static files (CSS, JS)
├── templates/         # HTML templates
├── uploads/          # Upload directory
└── processed/        # Processed files directory
```

## Environment Variables
Create a `.env` file in the root directory:
```env
FLASK_APP=app.py
FLASK_ENV=development
FLASK_DEBUG=1
```

## Built With
- Flask - Web framework
- librosa - Audio processing
- WaveSurfer.js - Audio visualization
- Bootstrap - Frontend framework

## License
MIT License - see [LICENSE](LICENSE) file for details#   s o n g - m o d i f i c a t i o n - t o o l 
 
 