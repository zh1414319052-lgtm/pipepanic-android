"""Compress surface profiles from the approved Mantaflow mesh cache for WebGL."""
import base64
import gzip
from pathlib import Path
import struct
import sys
import zipfile

source = Path(sys.argv[1])
archive = zipfile.ZipFile(source) if source.is_file() else None
width, frames = 64, 64
samples = []
for f in range(32,32+frames):
    name = f'fluid_mesh_{f:04d}.bobj.gz'
    raw = gzip.decompress(archive.read(name) if archive else (source / name).read_bytes())
    count, = struct.unpack_from('<I',raw)
    # The right sight line has a consistently supplied horizontal run.
    bins = [[] for _ in range(width)]
    for x,y,z in struct.iter_unpack('<fff',raw[4:4+12*count]):
        if .125 < x < .383 and .138 < y < .165:
            bins[min(width-1,int((x-.125)/.258*width))].append(z)
    crest = [max(b) if b else None for b in bins]
    assert sum(v is not None for v in crest) > width/2, f
    measured = [(i,v) for i,v in enumerate(crest) if v is not None]
    samples.extend(v if v is not None else min(measured,key=lambda p:abs(p[0]-i))[1]
                   for i,v in enumerate(crest))
ordered=sorted(samples)
if archive:
    archive.close()
low,high=ordered[len(ordered)//50],ordered[-len(ordered)//50]
assert high>low
data=bytes(round(255*max(0,min(1,(v-low)/(high-low)))) for v in samples)
encoded=base64.b64encode(data).decode()
target=Path(__file__).resolve().parents[2]/'app/src/main/assets/jspp/pump-water.js'
target.write_text(f"// Mantaflow profiles. Rebuild with tools/art/extract_flow.py.\nvar pumpWaterData = '{encoded}';\n",encoding='utf8')
print(target,len(data),low,high)
