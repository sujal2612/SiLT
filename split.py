import splitfolders
import os

dr = 'SignImage48x48'
output_dir = "splitdataset48x48"

# Check if source directory exists
if not os.path.exists(dr):
    raise FileNotFoundError(f"Source directory not found: {dr}. Please create it first or check the path.")

# Create output directory if it doesn't exist
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Split the dataset
splitfolders.ratio(dr, output_dir, ratio=(0.8, 0.2))
print(f"Dataset split completed! Training data: 80%, Validation data: 20%")