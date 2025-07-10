from flask import Flask, render_template, request, jsonify, redirect, url_for, send_from_directory
import os
import json
import threading
import time
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
DATA_FILE = 'data.json'
MAX_IMAGES = 10
DISPLAY_TIME = 5  # seconds
FADEOUT_TIME = 10  # seconds

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r') as f:
            return json.load(f)
    return []

def save_data(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def cleanup_old_images():
    while True:
        try:
            data = load_data()
            current_time = datetime.now()
            updated_data = []
            
            for image in data:
                upload_time = datetime.fromisoformat(image['timestamp'])
                total_time = DISPLAY_TIME + FADEOUT_TIME
                
                if current_time - upload_time > timedelta(seconds=total_time):
                    # Delete file
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], image['filename'])
                    if os.path.exists(file_path):
                        os.remove(file_path)
                else:
                    updated_data.append(image)
            
            if len(updated_data) != len(data):
                save_data(updated_data)
                
        except Exception as e:
            print(f"Error in cleanup: {e}")
        
        time.sleep(2)

# Start cleanup thread
cleanup_thread = threading.Thread(target=cleanup_old_images, daemon=True)
cleanup_thread.start()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/gallery')
def gallery():
    return render_template('gallery.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file selected'}), 400
    
    file = request.files['file']
    comment = request.form.get('comment', '').strip()
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if len(comment) > 100:
        return jsonify({'error': 'Comment too long (max 100 characters)'}), 400
    
    if file and allowed_file(file.filename):
        # Create unique filename
        timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
        filename = f"{timestamp}_{secure_filename(file.filename)}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        file.save(filepath)
        
        # Load existing data
        data = load_data()
        
        # Add new image
        new_image = {
            'filename': filename,
            'comment': comment,
            'timestamp': datetime.now().isoformat()
        }
        data.append(new_image)
        
        # Remove oldest if exceeding max
        if len(data) > MAX_IMAGES:
            oldest = data.pop(0)
            old_filepath = os.path.join(app.config['UPLOAD_FOLDER'], oldest['filename'])
            if os.path.exists(old_filepath):
                os.remove(old_filepath)
        
        save_data(data)
        
        return jsonify({'success': True, 'filename': filename})
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/api/images')
def get_images():
    data = load_data()
    current_time = datetime.now()
    
    # Add display state for each image
    for image in data:
        upload_time = datetime.fromisoformat(image['timestamp'])
        elapsed = (current_time - upload_time).total_seconds()
        
        if elapsed < DISPLAY_TIME:
            image['state'] = 'visible'
        elif elapsed < DISPLAY_TIME + FADEOUT_TIME:
            image['state'] = 'fading'
        else:
            image['state'] = 'expired'
    
    return jsonify(data)

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    app.run(debug=True, host='0.0.0.0', port=5000)