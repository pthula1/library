# Pocket Library

A personal library and checkout tracker designed for mobile Safari and Android browsers.

## Publish with GitHub Pages
1. Upload the contents of this folder to the root of your GitHub repository (not the folder itself).
2. In repository Settings → Pages, choose **Deploy from a branch**, branch **main**, folder **/(root)**, and Save.
3. Open the published HTTPS URL in Safari.
4. Use Share → Add to Home Screen.

## Scanner
The ISBN scanner uses the ZXing browser library from jsDelivr, so the first scan needs an internet connection. Allow camera access in Safari. Scan the ISBN barcode on the back cover, usually EAN-13 (978 or 979), rather than the retail price barcode.

## Data and privacy
Book and lending data is saved in localStorage on the current browser/device. It is not uploaded to GitHub. Export JSON backups regularly. Clearing website data may erase the library. Book lookup uses the Open Library Books API.

## Troubleshooting
- Camera requires HTTPS and Safari permission.
- If old code is cached, close the Home Screen app, open the website in Safari, refresh, then close and reopen it.
- If a scan detects the wrong barcode, cover nearby barcodes and center the ISBN barcode in good light.
- Manual ISBN entry is available in the scanner dialog.
