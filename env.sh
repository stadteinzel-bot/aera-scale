#!/bin/sh


# 1. Gemini
GEMINI_KEY=${GEMINI_API_KEY:-${VITE_GEMINI_API_KEY:-""}}

# 2. Firebase
FB_API_KEY=${FIREBASE_API_KEY:-${VITE_FIREBASE_API_KEY:-""}}
FB_AUTH_DOMAIN=${FIREBASE_AUTH_DOMAIN:-${VITE_FIREBASE_AUTH_DOMAIN:-""}}
FB_PROJECT_ID=${FIREBASE_PROJECT_ID:-${VITE_FIREBASE_PROJECT_ID:-""}}
FB_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET:-${VITE_FIREBASE_STORAGE_BUCKET:-""}}
FB_SENDER_ID=${FIREBASE_MESSAGING_SENDER_ID:-${VITE_FIREBASE_MESSAGING_SENDER_ID:-""}}
FB_APP_ID=${FIREBASE_APP_ID:-${VITE_FIREBASE_APP_ID:-""}}

# 3. Google Maps
MAPS_KEY=${GOOGLE_MAPS_API_KEY:-${VITE_GOOGLE_MAPS_API_KEY:-""}}

echo "Injecting Runtime Environment Variables..."

OBJ="window._env_ = { \
  VITE_GEMINI_API_KEY: \"$GEMINI_KEY\", \
  VITE_FIREBASE_API_KEY: \"$FB_API_KEY\", \
  VITE_FIREBASE_AUTH_DOMAIN: \"$FB_AUTH_DOMAIN\", \
  VITE_FIREBASE_PROJECT_ID: \"$FB_PROJECT_ID\", \
  VITE_FIREBASE_STORAGE_BUCKET: \"$FB_STORAGE_BUCKET\", \
  VITE_FIREBASE_MESSAGING_SENDER_ID: \"$FB_SENDER_ID\", \
  VITE_FIREBASE_APP_ID: \"$FB_APP_ID\", \
  VITE_GOOGLE_MAPS_API_KEY: \"$MAPS_KEY\" \
};"

# Use a temporary file for cleaner substitution
sed "s|<script id=\"env-config\"></script>|<script>$OBJ</script>|g" /usr/share/nginx/html/index.html > /tmp/index.html && mv /tmp/index.html /usr/share/nginx/html/index.html

echo "Done. Starting Nginx..."
exec "$@"
