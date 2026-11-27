"""Committed platform files must not carry secret material."""

import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[2]
SCAN_ROOTS = ("terraform", "helm", "platform", "scripts", ".github", "docs", "observability")
FORBIDDEN = re.compile(
    r"BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|client_secret\s*=\s*\"[^\"]+\"|password\s*=\s*\"[^\"]+\"|AKIA[0-9A-Z]{16}",
    re.IGNORECASE,
)


class NoSecretFilesTest(unittest.TestCase):
    def test_platform_tree_has_no_secret_literals(self) -> None:
        offenders = []
        for name in SCAN_ROOTS:
            base = ROOT / name
            for path in base.rglob("*"):
                if not path.is_file() or path.suffix in {".png", ".svg"}:
                    continue
                text = path.read_text(errors="ignore")
                if FORBIDDEN.search(text):
                    offenders.append(str(path.relative_to(ROOT)))
        self.assertEqual(offenders, [])

    def test_kops_directory_is_absent(self) -> None:
        self.assertFalse((ROOT / "kops").exists())


if __name__ == "__main__":
    unittest.main()
