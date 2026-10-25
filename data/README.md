# Map data

| file | content | source / licence |
|---|---|---|
| `world.json` | countries (10m, simplified) for the 3D map | Natural Earth, public domain (`prep.py`) |
| `globe.json` | countries (50m) for the globe | Natural Earth, public domain (`prep.py`) |
| `places.json` | capitals and large cities (names usable directly as `loc`) | Natural Earth, public domain (`prep.py`) |
| `regions.json` | first-level regions (oblasts, provinces, states) with ISO 3166-2 codes — usable as `iso` in `tint`/`extrude`/`zone clip` and as `loc` | Natural Earth admin-1, public domain (`prep_regions.py`) |
| `gazetteer.tsv.gz` | ~170,000 towns with ≥ 1,000 inhabitants (name, country, lon, lat) for `tools/places.py` | GeoNames via github.com/lutangar/cities.json, **CC BY 4.0** — credited in every long-form description |

Natural Earth assigns Crimea and Sevastopol (UA-43, UA-40) to Russia (de facto). When a video shows them, say how their status is disputed (annexed by Russia in 2014, not recognised by most countries) instead of relying on the map colour.
