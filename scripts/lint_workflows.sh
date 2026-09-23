#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

version=1.7.12
system="$(uname -s)"
machine="$(uname -m)"

case "$system/$machine" in
  Linux/x86_64)
    platform=linux_amd64
    checksum=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8
    ;;
  Linux/aarch64|Linux/arm64)
    platform=linux_arm64
    checksum=325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6
    ;;
  Darwin/arm64)
    platform=darwin_arm64
    checksum=aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f
    ;;
  Darwin/x86_64)
    platform=darwin_amd64
    checksum=5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644
    ;;
  *)
    echo "Unsupported actionlint platform: $system/$machine" >&2
    exit 1
    ;;
esac

temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT HUP INT TERM
archive="actionlint_${version}_${platform}.tar.gz"
url="https://github.com/rhysd/actionlint/releases/download/v${version}/${archive}"

curl --fail --silent --show-error --location "$url" --output "$temporary_dir/$archive"
printf '%s  %s\n' "$checksum" "$temporary_dir/$archive" | shasum -a 256 --check --status
tar -xzf "$temporary_dir/$archive" -C "$temporary_dir" actionlint
"$temporary_dir/actionlint" -color
