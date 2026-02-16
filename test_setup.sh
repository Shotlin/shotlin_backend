#!/bin/bash

BASE_URL="http://127.0.0.1:4000/api/v1"

echo "🔍 Testing Shotlin Backend..."

# 1. Check Health
echo "\n1. Checking Server Health..."
curl -s http://127.0.0.1:4000/ | grep "Shotlin Backend" && echo "✅ Server is UP" || echo "❌ Server is DOWN"

# 2. Register Admin
echo "\n2. Registering Admin User..."
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@shotlin.com", "password": "adminpassword", "name": "Admin Boss"}')
echo $REGISTER_RESPONSE

# 3. Login Admin
echo "\n3. Logging in Admin..."
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@shotlin.com", "password": "adminpassword"}')
echo $LOGIN_RESPONSE

# Extract Token (simple grep/sed)
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$TOKEN" ]; then
  echo "❌ Login Failed"
else
  echo "✅ Login Successful. Token: ${TOKEN:0:10}..."
fi

# 4. Submit Contact Form
echo "\n4. Submitting Contact Form..."
CONTACT_RESPONSE=$(curl -s -X POST $BASE_URL/contact \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@user.com", "subject": "Hello Backend", "message": "This is a test message from the script."}')
echo $CONTACT_RESPONSE

echo "\n-----------------------------------"
echo "✅ Verification Complete"
echo "-----------------------------------"
