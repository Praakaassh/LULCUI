import ee
ee.Initialize()
print(ee.Image("ESA/WorldCover/v100/2020").bandNames().getInfo())
