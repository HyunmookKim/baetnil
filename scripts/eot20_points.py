# 뱃일 5.10 — 전 세계 해안의 조석 조화상수를 위성 조석 모형 EOT20 에서 뽑는다.
#
#   사장님 지시 (2026-09-22): 「가용한 관측소가 없는 경우에만 추정값을 쓰고, 되도록 관측소를 찾아라」
#   ★ 관측소(TICON-4·NOAA)가 없는 바다는 여태 Open-Meteo 해수면 추정값을 썼다 (20~35분 어긋남, 기준면 없음).
#   ★ EOT20 (DGFI-TUM, 0.125° 격자, CC BY 4.0, doi:10.17882/79489) 은 위성 고도계로 만든 전 세계 조석 모형이다.
#     해안을 따라 격자의 분조를 뽑아 두면, 관측소가 없는 바다에서도 관측소처럼 조화상수로 셈할 수 있다.
#   ★ 뽑는 자리: 바다 격자 중 뭍에 닿은 칸(해안) — 서로 TRK km 이상 떨어지게 솎고,
#     관측소가 NEAR km 안에 있는 곳은 뺀다(관측소가 이긴다).
#   ★ SA·SSA(계절 수위)는 뺀다 — 5.8 에서 관측과 위상이 100° 어긋나는 것을 확인했다.
import glob, json, math, os, sys
import numpy as np, netCDF4

D = sys.argv[1]            # EOT20 ocean_tides 폴더
OUT = sys.argv[2]
SPACE_KM = float(os.environ.get('SPACE_KM', '20'))
NEAR_KM = float(os.environ.get('NEAR_KM', '30'))
MAXLAT = 72.0
SKIP = {'SA', 'SSA'}
CAP = {'M2':800,'S2':400,'N2':200,'K2':150,'K1':400,'O1':300,'P1':150,'Q1':60,'S1':30,'T2':60,'2N2':60,'J1':40,'M4':200,'MF':30,'MM':30}   # cm — 세계에서 가장 큰 값(펀디만 M2 · 오호츠크해 셸리호프만 K1)보다 넉넉히 위

files = sorted(glob.glob(os.path.join(D, '**', '*_ocean_eot20.nc'), recursive=True))
if not files: sys.exit('EOT20 파일을 못 찾음: ' + D)
C = {}
lat = lon = None
for f in files:
    c = os.path.basename(f).split('_')[0].upper()
    if c in SKIP: continue
    ds = netCDF4.Dataset(f)
    if lat is None:
        lat = np.array(ds['lat'][:], dtype='f8'); lon = np.array(ds['lon'][:], dtype='f8')
    a = np.ma.filled(ds['amplitude'][:].astype('f4'), np.nan)
    p = np.ma.filled(ds['phase'][:].astype('f4'), np.nan)
    ds.close()
    C[c] = (a, p)
    print(c, a.shape, float(np.nanmax(a)), flush=True)
M2 = C['M2'][0]
ok = ~np.isnan(M2)
# 뭍(NaN)과 붙은 바다 칸 = 해안
land = ~ok
nb = np.zeros_like(ok)
for di in (-1, 0, 1):
    for dj in (-1, 0, 1):
        if di == 0 and dj == 0: continue
        nb |= np.roll(np.roll(land, di, axis=0), dj, axis=1)
coast = ok & nb
ii, jj = np.nonzero(coast)
print('해안 칸', len(ii), flush=True)

st = json.load(open(os.path.join(os.path.dirname(__file__), 'hc_stations.json')))
def cell(la, lo, sz): return (int(math.floor(la / sz)), int(math.floor(((lo + 540) % 360 - 180) / sz)))
SZ = 0.5
sgrid = {}
for la, lo in st:
    sgrid.setdefault(cell(la, lo, SZ), []).append((la, lo))
def hav(a, b, c, d):
    r = math.pi / 180
    x = math.sin((c - a) * r / 2) ** 2 + math.cos(a * r) * math.cos(c * r) * math.sin((d - b) * r / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(min(1, x)))
def near_station(la, lo):
    k = cell(la, lo, SZ)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            for (a, b) in sgrid.get((k[0] + di, k[1] + dj), []):
                if hav(la, lo, a, b) < NEAR_KM: return True
    return False

kept = {}
out = []
order = np.lexsort((jj, ii))
for n in order:
    i, j = int(ii[n]), int(jj[n])
    la = float(lat[i]); lo = float(lon[j]); lo = ((lo + 180) % 360) - 180
    if abs(la) > MAXLAT: continue
    k = cell(la, lo, SZ)
    close = False
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            for (a, b) in kept.get((k[0] + di, k[1] + dj), []):
                if hav(la, lo, a, b) < SPACE_KM: close = True; break
            if close: break
        if close: break
    if close: continue
    if near_station(la, lo): continue
    # ★ 격자 가장자리에 말이 안 되는 값이 있다 (실제로 P1 1,101cm · S1 4,575cm 가 찍혔다).
    #   세계에서 가장 큰 조석(펀디만)도 M2 가 6m 남짓이다. 분조별 상한을 넘는 칸은 통째로 버린다.
    bad = False
    for c, (A, P) in C.items():
        a = float(A[i, j])
        if not math.isnan(a) and a > CAP.get(c, 100): bad = True; break
    if bad: continue
    cons = []
    for c, (A, P) in C.items():
        a = float(A[i, j]); p = float(P[i, j])
        if math.isnan(a) or math.isnan(p): continue
        amm = a * 10.0            # EOT20 은 cm → mm
        if amm < 3: continue      # 3mm 안 되는 분조는 뺀다 (관측소 꾸러미와 같은 기준)
        cons.append([c, round(amm, 1), round(p % 360, 2)])
    if not any(c[0] == 'M2' for c in cons): continue
    kept.setdefault(k, []).append((la, lo))
    out.append([round(la, 4), round(lo, 4), cons])
print('뽑은 점', len(out), flush=True)
json.dump(out, open(OUT, 'w'))
