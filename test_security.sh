#!/bin/bash

# Define colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔍 Starting Security Audit..."

# Create dummy files
echo "im image" > test.jpg
echo "im bad script" > hack.sh
echo "im bad exe" > malware.exe

# 1. Test Valid Upload (should succeed)
echo -e "\n1. Testing Valid JPG Upload..."
RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/upload \
  -F "file=@test.jpg;type=image/jpeg")

if [[ $RESPONSE == *"url"* ]]; then
  echo -e "${GREEN}PASS: Valid file uploaded successfully${NC}"
else
  echo -e "${RED}FAIL: Valid file upload failed${NC}"
  echo $RESPONSE
fi

# 2. Test Malicious Extension (should fail)
echo -e "\n2. Testing .sh File Upload..."
RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/upload \
  -F "file=@hack.sh;type=application/x-sh")

if [[ $RESPONSE == *"Security Warning"* || $RESPONSE == *"Invalid file type"* ]]; then
  echo -e "${GREEN}PASS: .sh file blocked successfully${NC}"
else
  echo -e "${RED}FAIL: .sh file was NOT blocked${NC}"
  echo $RESPONSE
fi

# 3. Test Masquerading File (dangerous extension renamed to .jpg - should fail via mime check if strict, or pass if shallow)
# Note: Our implementation checks mime type provided by client/busboy. 
# Robust server-side mime sniffing (magic numbers) is harder in Node streams without buffering.
# But we DO check the extension.
# Let's try uploading a file with .exe extension but declaring image/jpeg mime.
echo -e "\n3. Testing .exe with fake mime type..."
RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/upload \
  -F "file=@malware.exe;type=image/jpeg")

# Expecting "Security Warning" because we check the extension explicitly
if [[ $RESPONSE == *"Security Warning"* ]]; then
  echo -e "${GREEN}PASS: .exe file blocked despite fake mime type${NC}"
else
  echo -e "${RED}FAIL: .exe file with fake mime was NOT blocked${NC}"
  echo $RESPONSE
fi

# Cleanup
rm test.jpg hack.sh malware.exe
