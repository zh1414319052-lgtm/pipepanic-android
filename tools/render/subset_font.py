"""Preserve previous UI coverage and add current localized strings. Noto / OFL."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont
import sys
root=Path(__file__).resolve().parents[2]
target=root/'app/src/main/assets/jspp/PipeNoto.ttf'
chars=set(TTFont(target).getBestCmap())
for folder,pattern in [(root/'app/src/main/assets/jspp','*.js'),(root/'app/src/main/res','*.xml')]:
 for p in folder.rglob(pattern):
  if p.name in ('fidelity-assets.js','fidelity-water.js','fidelity-runtime.js','pump-meshes.js'):continue
  chars.update(map(ord,p.read_text(encoding='utf8')))
font=TTFont(sys.argv[1])
if 'fvar' in font:font=instantiateVariableFont(font,{'wght':500},inplace=True)
options=subset.Options();options.name_IDs=['*'];options.name_legacy=True
worker=subset.Subsetter(options=options);worker.populate(unicodes=chars);worker.subset(font);font.save(target)
print('Noto Sans SC / SIL OFL 1.1:',len(font.getBestCmap()),'glyph codepoints')
