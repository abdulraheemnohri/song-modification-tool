import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_index_route(client):
    """Test the index route returns 200"""
    rv = client.get('/')
    assert rv.status_code == 200

def test_upload_no_file(client):
    """Test upload endpoint without file"""
    rv = client.post('/upload')
    assert rv.status_code == 400
    assert b'No file part' in rv.data

def test_allowed_file():
    """Test file extension validation"""
    from app import allowed_file
    assert allowed_file('test.mp3') == True
    assert allowed_file('test.wav') == True
    assert allowed_file('test.txt') == False
