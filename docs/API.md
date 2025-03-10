# API Reference

## Audio Processing Endpoints

### Upload Audio
`POST /upload`
- Upload an audio file
- Supports: MP3, WAV, OGG, M4A, WEBA, WEBM
- Max size: 16MB

### Modify Audio
`POST /modify`
```json
{
    "filename": "example.mp3",
    "speed": 1.0,
    "pitch": 0
}
```

### Apply Effects
`POST /reverb`
```json
{
    "filename": "example.mp3",
    "room_size": 0.5,
    "damping": 0.5
}
```

### Process Audio
`POST /eq`
```json
{
    "filename": "example.mp3",
    "bass": 0,
    "mid": 0,
    "treble": 0
}
```

## Response Format
All API endpoints return JSON:
```json
{
    "message": "Operation successful",
    "processed_file": "processed_example.mp3"
}
```

## Error Handling
Errors return with appropriate HTTP status codes:
```json
{
    "error": "Error description"
}
```
