# Serve locally at http://localhost:8000 (service workers work on localhost without HTTPS)
serve port="8000":
    python3 -m http.server {{port}}

# Render the PNG icons from icons/icon.svg
icons:
    inkscape icons/icon.svg --export-type=png -w 512 -h 512 -o icons/icon-512.png
    inkscape icons/icon.svg --export-type=png -w 192 -h 192 -o icons/icon-192.png
    inkscape icons/icon.svg --export-type=png -w 180 -h 180 -o icons/apple-touch-icon.png
