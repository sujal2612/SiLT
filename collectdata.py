import cv2
import os
import numpy as np

directory = 'SignImage48x48/'
print(os.getcwd())

if not os.path.exists(directory):
    os.mkdir(directory)
if not os.path.exists(os.path.join(directory, 'blank')):
    os.mkdir(os.path.join(directory, 'blank'))

for i in range(65, 91):
    letter = chr(i)
    letter_dir = os.path.join(directory, letter)
    if not os.path.exists(letter_dir):
        os.mkdir(letter_dir)

# Initialize camera
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Error: Could not open camera. Please check if your camera is connected.")
    exit()

while True:
    ret, frame = cap.read()
    if not ret:
        print("Error: Could not read frame from camera.")
        break
    count = {
             'a': len(os.listdir(os.path.join(directory, "A"))),
             'b': len(os.listdir(os.path.join(directory, "B"))),
             'c': len(os.listdir(os.path.join(directory, "C"))),
             'd': len(os.listdir(os.path.join(directory, "D"))),
             'e': len(os.listdir(os.path.join(directory, "E"))),
             'f': len(os.listdir(os.path.join(directory, "F"))),
             'g': len(os.listdir(os.path.join(directory, "G"))),
             'h': len(os.listdir(os.path.join(directory, "H"))),
             'i': len(os.listdir(os.path.join(directory, "I"))),
             'j': len(os.listdir(os.path.join(directory, "J"))),
             'k': len(os.listdir(os.path.join(directory, "K"))),
             'l': len(os.listdir(os.path.join(directory, "L"))),
             'm': len(os.listdir(os.path.join(directory, "M"))),
             'n': len(os.listdir(os.path.join(directory, "N"))),
             'o': len(os.listdir(os.path.join(directory, "O"))),
             'p': len(os.listdir(os.path.join(directory, "P"))),
             'q': len(os.listdir(os.path.join(directory, "Q"))),
             'r': len(os.listdir(os.path.join(directory, "R"))),
             's': len(os.listdir(os.path.join(directory, "S"))),
             't': len(os.listdir(os.path.join(directory, "T"))),
             'u': len(os.listdir(os.path.join(directory, "U"))),
             'v': len(os.listdir(os.path.join(directory, "V"))),
             'w': len(os.listdir(os.path.join(directory, "W"))),
             'x': len(os.listdir(os.path.join(directory, "X"))),
             'y': len(os.listdir(os.path.join(directory, "Y"))),
             'z': len(os.listdir(os.path.join(directory, "Z"))),
             'blank': len(os.listdir(os.path.join(directory, "blank")))
             }

    row = frame.shape[1]
    col = frame.shape[0]
    cv2.rectangle(frame,(0,40),(400,440),(255,255,255),2)
    cv2.imshow("data",frame)
    roi=frame[40:440,0:400]
    cv2.imshow("ROI", roi)

    # ===== 1. Lighting Optimization (CLAHE) =====
    ycrcb = cv2.cvtColor(roi, cv2.COLOR_BGR2YCrCb)
    y, cr, cb = cv2.split(ycrcb)
    clahe = cv2.createCLAHE(3.0, (8,8))
    y = clahe.apply(y)
    roi = cv2.cvtColor(cv2.merge([y, cr, cb]), cv2.COLOR_YCrCb2BGR)

    # ===== 2. Skin-Based Hand Segmentation =====
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    lower = np.array([0, 20, 70])
    upper = np.array([20, 255, 255])
    mask = cv2.inRange(hsv, lower, upper)

    mask = cv2.GaussianBlur(mask, (7, 7), 0)
    mask = cv2.medianBlur(mask, 7)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7,7), np.uint8))


    # ===== 3. Background blur =====
    blurred = cv2.GaussianBlur(roi, (45, 45), 0)
    mask3 = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR) / 255.0

    roi_blended = (roi * mask3 + blurred * (1 - mask3)).astype(np.uint8)

    # ===== 4. Auto center hand =====
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if len(contours) > 0:
        c = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(c)

        pad = 15
        x = max(0, x - pad)
        y = max(0, y - pad)
        w = min(w + pad * 2, roi_blended.shape[1] - x)
        h = min(h + pad * 2, roi_blended.shape[0] - y)

        hand_crop = roi_blended[y:y+h, x:x+w]
    else:
        hand_crop = roi_blended

    # ===== 5. Final 48×48 grayscale image =====
    frame = cv2.cvtColor(hand_crop, cv2.COLOR_BGR2GRAY)
    frame = cv2.resize(frame, (48,48))
    interrupt = cv2.waitKey(10)
    if interrupt & 0xFF == ord('a'):
        cv2.imwrite(os.path.join(directory, 'A', str(count['a']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('b'):
        cv2.imwrite(os.path.join(directory, 'B', str(count['b']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('c'):
        cv2.imwrite(os.path.join(directory, 'C', str(count['c']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('d'):
        cv2.imwrite(os.path.join(directory, 'D', str(count['d']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('e'):
        cv2.imwrite(os.path.join(directory, 'E', str(count['e']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('f'):
        cv2.imwrite(os.path.join(directory, 'F', str(count['f']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('g'):
        cv2.imwrite(os.path.join(directory, 'G', str(count['g']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('h'):
        cv2.imwrite(os.path.join(directory, 'H', str(count['h']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('i'):
        cv2.imwrite(os.path.join(directory, 'I', str(count['i']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('j'):
        cv2.imwrite(os.path.join(directory, 'J', str(count['j']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('k'):
        cv2.imwrite(os.path.join(directory, 'K', str(count['k']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('l'):
        cv2.imwrite(os.path.join(directory, 'L', str(count['l']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('m'):
        cv2.imwrite(os.path.join(directory, 'M', str(count['m']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('n'):
        cv2.imwrite(os.path.join(directory, 'N', str(count['n']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('o'):
        cv2.imwrite(os.path.join(directory, 'O', str(count['o']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('p'):
        cv2.imwrite(os.path.join(directory, 'P', str(count['p']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('q'):
        cv2.imwrite(os.path.join(directory, 'Q', str(count['q']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('r'):
        cv2.imwrite(os.path.join(directory, 'R', str(count['r']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('s'):
        cv2.imwrite(os.path.join(directory, 'S', str(count['s']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('t'):
        cv2.imwrite(os.path.join(directory, 'T', str(count['t']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('u'):
        cv2.imwrite(os.path.join(directory, 'U', str(count['u']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('v'):
        cv2.imwrite(os.path.join(directory, 'V', str(count['v']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('w'):
        cv2.imwrite(os.path.join(directory, 'W', str(count['w']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('x'):
        cv2.imwrite(os.path.join(directory, 'X', str(count['x']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('y'):
        cv2.imwrite(os.path.join(directory, 'Y', str(count['y']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('z'):
        cv2.imwrite(os.path.join(directory, 'Z', str(count['z']) + '.jpg'), frame)
    if interrupt & 0xFF == ord('.'):
        cv2.imwrite(os.path.join(directory, 'blank', str(count['blank']) + '.jpg'), frame)
    
    # Exit on 'q' key press
    if interrupt & 0xFF == ord('q'):
        break

# Clean up
cap.release()
cv2.destroyAllWindows()
print("Camera released. Goodbye!")


    