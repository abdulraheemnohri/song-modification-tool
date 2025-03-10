# Development Guide

## Setup Development Environment

### Prerequisites
```bash
Python 3.8+
FFmpeg
Git
```

### Installation
1. Clone and setup:
```bash
git clone https://github.com/abdulraheemnohri/song-modification-tool.git
cd song-modification-tool
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
pip install -r requirements-dev.txt
```

2. Environment variables:
```env
FLASK_APP=app.py
FLASK_ENV=development
FLASK_DEBUG=1
```

## Project Structure

