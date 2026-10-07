#!/bin/bash
# Test the Raspberry Pi file server (Seafile) the same way the Office app will use it.
# Run:  bash scripts/test-pi-storage.sh
# It asks for the library token privately (nothing is shown or saved).
BASE="https://files.aayamfiles.com"
API="$BASE/api/v2.1/via-repo-token"
read -s -p "Library token: " T; echo
H="Authorization: Token $T"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
ok(){ echo "  PASS  $1"; }; bad(){ echo "  FAIL  $1  ->  $2"; FAILED=1; }
FAILED=0

echo "1) Library info"
R=$(curl -s -H "$H" "$API/repo-info/"); echo "$R" | grep -q '"repo_name":"aayam-app"' && ok "token works for aayam-app" || bad "repo-info" "$R"

echo "2) Upload link"
L=$(curl -s -H "$H" "$API/upload-link/?path=/&from=api" | tr -d '"')
L=$(echo "$L" | sed 's#^http://files.aayamfiles.com#https://files.aayamfiles.com#')
case "$L" in https://files.aayamfiles.com/seafhttp/*) ok "upload link is on your domain (made https)";; *) bad "upload-link" "$L";; esac

echo "3) Small file into a NEW folder (relative_path)"
echo "hello from test $(date)" > "$TMP/small.txt"
R=$(curl -s -F parent_dir=/ -F relative_path="_pi_test/sub folder" -F replace=0 -F "file=@$TMP/small.txt;filename=small test.txt" "$L?ret-json=1")
echo "$R" | grep -q 'small test.txt' && ok "uploaded: $R" || bad "small upload" "$R"

echo "4) Download link + content"
D=$(curl -s -H "$H" "$API/download-link/?path=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("/_pi_test/sub folder/small test.txt"))')" | tr -d '"')
curl -s "$D" | grep -q "hello from test" && ok "downloaded the same content" || bad "download" "$D"

echo "5) Big file (120 MB) in 3 pieces of 40 MB — like a real design file"
dd if=/dev/urandom of="$TMP/big.bin" bs=1048576 count=120 2>/dev/null
L2=$(curl -s -H "$H" "$API/upload-link/?path=/&from=api" | tr -d '"')
SZ=$((120*1048576)); PC=$((40*1048576)); S=0; LASTR=""
while [ $S -lt $SZ ]; do
  E=$((S+PC-1)); dd if="$TMP/big.bin" of="$TMP/part" bs=1048576 skip=$((S/1048576)) count=40 2>/dev/null
  LASTR=$(curl -s -w ' [HTTP %{http_code}]' -H "Content-Range: bytes $S-$E/$SZ" -H "Content-Disposition: attachment; filename=\"big.bin\"" -F parent_dir=/ -F relative_path="_pi_test" -F replace=0 -F "file=@$TMP/part;filename=big.bin" "$L2?ret-json=1")
  echo "     piece $((S/PC+1))/3 -> $LASTR"
  S=$((E+1))
done
echo "$LASTR" | grep -q 'big.bin' && ok "big file accepted in pieces" || bad "chunked upload" "$LASTR"
BIGDL=$(curl -s -H "$H" "$API/download-link/?path=/_pi_test/big.bin" | tr -d '"')
SIZE=$(curl -s "$BIGDL" | wc -c | tr -d ' ')
[ "$SIZE" = "$SZ" ] && ok "big file downloads with exactly the same size ($SIZE bytes)" || bad "big file size" "got $SIZE, expected $SZ"

echo "6) Browser permission check (CORS) — needed for uploads straight from the app"
CORS=$(curl -s -i -X OPTIONS -H "Origin: https://example.vercel.app" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-range,content-disposition,content-type" "$L" | tr -d '\r' | grep -i '^access-control' | tr '\n' ' ')
echo "$CORS" | grep -qi 'allow-origin' && ok "$CORS" || bad "CORS" "none ($CORS)"

echo "7) Delete the test files"
for P in "/_pi_test/big.bin" "/_pi_test/sub folder/small test.txt"; do
  C=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -H "$H" "$API/file/?path=$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$P")")
  [ "$C" = "200" ] && ok "deleted $P" || bad "delete $P" "HTTP $C"
done
echo; [ $FAILED = 0 ] && echo "ALL GOOD - the Pi is ready." || echo "Some checks FAILED - send me this whole screen."
echo "(You can delete the empty '_pi_test' folder in the Seafile website.)"
