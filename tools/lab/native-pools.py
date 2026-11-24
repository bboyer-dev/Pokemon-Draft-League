"""Read native move acquisitions per game from the pinned PokéAPI CSV snapshot."""
import csv
import hashlib
import io
import json
import os
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen

REV = "de6760be38b60a3024f1d9054330ff265f0dc619"
CACHE = Path(os.environ.get("NPL_POKEAPI_DIR", "node_modules/.cache/npl-pokeapi/" + REV))
HASHES = {
    "pokemon": "eb8a7f59134bf3763a0f3072a7794cb097413e6f6027c380a92dd8d63082ab80",
    "moves": "bda125c910e66d1117e7c9547f981aa137d9fb70fe1cba417d8c85590618d7eb",
    "pokemon_moves": "24e0ace4ae8841e8879864b11247a5ad7058f34898b53f89df541284fc0847df",
}
# Ordered by game release. DLC belongs to the base game's learnset.
GAMES = {30:"Legends: Z-A",31:"Legends: Z-A",24:"Legends: Arceus",
         23:"Brilliant Diamond / Shining Pearl",20:"Sword / Shield",21:"Sword / Shield",22:"Sword / Shield",
         19:"Let’s Go, Pikachu! / Eevee!",18:"Ultra Sun / Ultra Moon",17:"Sun / Moon"}
def rows(name):
    file = CACHE / (name + ".csv")
    if not file.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        url = f"https://raw.githubusercontent.com/PokeAPI/pokeapi/{REV}/data/v2/csv/{name}.csv"
        data = urlopen(url, timeout=45).read()
    else:
        data = file.read_bytes()
    if hashlib.sha256(data).hexdigest() != HASHES[name]:
        raise ValueError(f"Unexpected PokéAPI data in {file}")
    if not file.exists():
        file.write_bytes(data)
    return csv.DictReader(io.StringIO(data.decode()))

pokemon = {r["id"]:r["identifier"].replace("-", "") for r in rows("pokemon")}
moves = {r["id"]:r["identifier"].replace("-", "") for r in rows("moves")}
games = defaultdict(lambda: defaultdict(set))
for row in rows("pokemon_moves"):
    game = GAMES.get(int(row["version_group_id"]))
    if game:
        games[game][pokemon[row["pokemon_id"]]].add(moves[row["move_id"]])
print(json.dumps({game:{p:sorted(m) for p,m in games[game].items()} for game in dict.fromkeys(GAMES.values())},separators=(",",":")))
