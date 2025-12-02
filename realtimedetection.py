from flask import Flask, render_template, request, jsonify, url_for, send_from_directory, abort
from flask_cors import CORS
import cv2
import numpy as np
import json
import os
import base64
from io import BytesIO
from PIL import Image
from gtts import gTTS

app = Flask(__name__)
CORS(app)

BASE_DIR = app.root_path
TEXT_SIGN_DIR = os.path.join(BASE_DIR, 'txt')
ALLOWED_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}

model_keras_path = "signlanguagedetectionmodel48x48.keras"
model_json_path = "signlanguagedetectionmodel48x48.json"
model_weights_path = "signlanguagedetectionmodel48x48.h5"

if not os.path.exists(model_keras_path) and not os.path.exists(model_json_path):
    raise FileNotFoundError(
        f"Model files not found. Please train the model first.\n"
        f"Expected: {model_keras_path} or {model_json_path}"
    )

model = None
try:
    from keras.models import load_model
    print("Loading model using standalone Keras (.keras)...")
    if os.path.exists(model_keras_path):
        model = load_model(model_keras_path)
        print("Model loaded successfully from .keras!")
except ImportError:
    from tensorflow.keras.models import load_model
    print("Loading model using TensorFlow Keras...")
    if os.path.exists(model_keras_path):
        model = load_model(model_keras_path)
        print("Model loaded successfully from .keras!")

if model is None:
    from tensorflow.keras.models import model_from_json
    with open(model_json_path, "r") as json_file:
        model = model_from_json(json_file.read())
    model.load_weights(model_weights_path)
    print("Model loaded from JSON + H5!")

class_names_path = "class_names.json"
if os.path.exists(class_names_path):
    with open(class_names_path, "r") as f:
        label = json.load(f)
    print(f"Loaded {len(label)} class labels!")
else:
    raise FileNotFoundError("class_names.json missing. Train the model first!")

# 🔥 FIXED: Updated preprocessing for 48×48
def extract_features(image):
    """Convert image → float32 normalized → reshape for model"""
    image = np.array(image, dtype=np.float32)
    image = image.reshape(1, 48, 48, 1)
    return image / 255.0


def preprocess_image(image_data):
    """Convert base64 → grayscale → resize → normalize"""
    try:
        if "," in image_data:
            image_data = image_data.split(",")[1]

       
        img_bytes = base64.b64decode(image_data)
        image = Image.open(BytesIO(img_bytes))

        
        image = image.convert("L") 
        # Resize to 48×48 (same as training)
        image = image.resize((48, 48))  # 🔥 EXACT match to training

        # Convert to numpy + normalization
        return extract_features(image)

    except Exception as e:
        print("Error preprocessing:", e)
        return None


@app.route('/')
def index():
    return render_template("index.html")

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'model_loaded': model is not None})

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        if "image" not in data:
            return jsonify({"error": "Image missing"}), 400

        processed = preprocess_image(data["image"])
        if processed is None:
            return jsonify({"error": "Image processing failed"}), 400

        pred = model.predict(processed, verbose=0)
        pred_label = label[np.argmax(pred)]
        confidence = float(np.max(pred) * 100)

        return jsonify({
            "prediction": pred_label,
            "confidence": round(confidence, 2)
        })

    except Exception as e:
        print("Predict error:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/sign-assets')
def sign_assets():
    assets = {}
    if os.path.isdir(TEXT_SIGN_DIR):
        for entry in os.listdir(TEXT_SIGN_DIR):
            name, ext = os.path.splitext(entry)
            if ext.lower() in ALLOWED_IMAGE_EXTENSIONS and len(name) == 1 and name.isalpha():
                assets[name.upper()] = url_for('serve_text_sign_asset', filename=entry)
    return jsonify({'assets': assets, 'expected_classes': label})

@app.route('/text-sign/<path:filename>')
def serve_text_sign_asset(filename):
    filename = os.path.basename(filename)
    if not os.path.isfile(os.path.join(TEXT_SIGN_DIR, filename)):
        abort(404)
    return send_from_directory(TEXT_SIGN_DIR, filename)

def synthesize_speech(text, lang="en"):
    speech = gTTS(text=text, lang=lang)
    buff = BytesIO()
    speech.write_to_fp(buff)
    buff.seek(0)
    return base64.b64encode(buff.read()).decode()

@app.route('/speak', methods=['POST'])
def speak():
    data = request.get_json()
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "No text provided"}), 400

    audio_base64 = synthesize_speech(text)
    return jsonify({"audio": audio_base64, "content_type": "audio/mpeg"})

if __name__ == "__main__":
    print("\n==== Sign Language Detection Server ====")
    print("Model classes loaded:", len(label))
    print("Running at http://localhost:5000\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
