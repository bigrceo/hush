"""hush listings | hush buy <listing> [input] | hush stats | hush check <tx>"""
import json
import sys

from .client import HushClient, HushError


def main(argv=None) -> int:
    a = list(sys.argv[1:] if argv is None else argv)
    if not a or a[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    c = HushClient()
    try:
        if a[0] == "listings":
            for l in c.listings():
                print(f"{l['id']:<20} {l['total']} {l['currency']:<5} {l['name']}")
            return 0
        if a[0] == "buy" and len(a) >= 2:
            out = c.buy(a[1], a[2] if len(a) > 2 else None)
        elif a[0] == "stats":
            out = c.stats()["totals"]
        elif a[0] == "check" and len(a) == 2:
            out = c.privacy_check(a[1])
        else:
            print(__doc__)
            return 2
        print(json.dumps(out, indent=2))
        return 0
    except HushError as e:
        print(f"error ({e.status}{', leash' if e.blocked_by else ''}): {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
