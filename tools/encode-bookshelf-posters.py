"""Encode exports from ?export-poster without baking HTML text into the image.

Usage: python3 tools/encode-bookshelf-posters.py /tmp/bookshelf-poster
Requires Pillow with WebP support. Input: PREFIX-{desktop,mobile,narrow}.png and
PREFIX-metadata.json captured at the viewports documented in README.md.
"""
from hashlib import sha256
from pathlib import Path
import json
import sys
import subprocess
from PIL import Image

prefix = Path(sys.argv[1])
metadata = json.loads(Path(str(prefix) + '-metadata.json').read_text())
for name in ['desktop','mobile','narrow']:
    entry = metadata[name]
    source = Image.open(str(prefix) + '-' + name + '.png')
    target = Path('assets/previews/bookshelf-' + name + '.webp')
    source.save(target, quality=92, method=6)
    small = target.with_name(target.stem+'-1x.webp')
    source.resize((round(source.width/2),round(source.height/2)),Image.Resampling.LANCZOS).save(small,quality=92,method=6)
    entry['src1x'] = '/'+str(small)
    entry['version1x'] = sha256(small.read_bytes()).hexdigest()[:12]
    entry['pixelWidth'] = source.width
    entry['pixelHeight'] = source.height
    entry['src'] = '/' + str(target)
    entry['version'] = sha256(target.read_bytes()).hexdigest()[:12]
    entry['centerSize'] = entry['widthEm'] / entry['centerEm'] * 100
    side = (entry['widthEm'] - entry['centerEm'] - 2) / 2
    entry['edgeSize'] = entry['widthEm'] / side * 100
    entry['edgePosition'] = 100 / (entry['widthEm'] - side)
    entry['gutterSize'] = entry['widthEm'] * 100
metadata['sourceFingerprint'] = subprocess.check_output(['node','tools/poster-source.mjs'],text=True)
Path('_data/bookshelf_poster.json').write_text(json.dumps(metadata, indent=2) + '\n')
