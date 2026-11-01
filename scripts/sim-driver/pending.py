"""Lists an app's pending local notifications from a simulator's data folder,
for `sim pending`. Run as `python3 -I pending.py USERNOTIFICATIONS_DIR BUNDLE`
(or `--raw FILE`, which prints one archive's generic form, to find the keys).

usernotificationsd keeps each app's requests in
<dir>/<folder>/PendingNotifications.plist, an NSKeyedArchiver archive of an
NSMutableArray of flat dicts, and <dir>/Library.plist maps bundle id to that
folder. The format is private and can change between iOS releases, so there
are two layers: resolve() turns the archive into plain Python without knowing
any key, and pending() maps each record to the output shape and refuses, by
name, any record it does not recognise. A guessed or partial record would let
a story pass on a list it never read.

Stdout is one JSON line, an array sorted by identifier of
{identifier, title, body, threadId, trigger}, where trigger is
{type: "calendar", dateComponents: {...set components only}, repeats} or
{type: "interval", seconds, repeats}. Notes go to stderr. Exit 0 with [] when
the app is not in Library.plist or has no pending file, 1 on a missing
directory or Library.plist, an unreadable archive or a record it does not
recognise.
"""
import json
import plistlib
import sys
from pathlib import Path

# NSDateComponents stores a component it has not set as NSIntegerMax
# (NSDateComponentUndefined), and may omit it altogether. A threshold, not
# that exact value: no real component comes near 2**62.
UNDEFINED = 2**62
# Output order of the components; the archive's key is NS.<name>.
COMPONENTS = ("era", "year", "month", "day", "hour", "minute", "second",
              "nanosecond", "weekday", "weekdayOrdinal", "quarter",
              "weekOfMonth", "weekOfYear", "yearForWeekOfYear")
# NSDateComponents keys that are not components of the date. A trigger that
# sets any of them (a pinned time zone or calendar, a leap month, a repeated
# day) fires differently from the floating one printed here, so each is
# refused unless it holds its default.
DATE_EXTRAS = {"calendar": None, "timeZone": None, "leapMonth": 0, "repeatedDay": False}


class Fail(Exception):
    pass


def resolve(archive):
    """The archive's root as plain Python: lists, dicts, scalars. An object
    with a class becomes a dict holding "$class" (its name) beside its keys;
    arrays and dictionaries become lists and dicts."""
    if archive.get("$archiver") != "NSKeyedArchiver":
        raise Fail("not an NSKeyedArchiver archive")
    objects = archive["$objects"]
    root = archive["$top"]["root"]

    def get(ref, path):
        if not isinstance(ref, plistlib.UID):
            return ref
        if ref.data in path:
            raise Fail("the archive refers back to itself at object %d" % ref.data)
        obj = objects[ref.data]
        if obj == "$null":
            return None
        path = path | {ref.data}
        if not isinstance(obj, dict):
            return obj
        name = None
        if "$class" in obj:
            name = get(obj["$class"], path)["$classname"]
        if name in ("NSArray", "NSMutableArray", "NSSet", "NSMutableSet"):
            return [get(x, path) for x in obj["NS.objects"]]
        if name in ("NSDictionary", "NSMutableDictionary"):
            return {get(k, path): get(v, path)
                    for k, v in zip(obj["NS.keys"], obj["NS.objects"])}
        if name in ("NSString", "NSMutableString"):
            return obj["NS.string"]
        out = {k: get(v, path) for k, v in obj.items() if k != "$class"}
        if name is not None:
            out["$class"] = name
        return out

    return get(root, frozenset())


def need(record, where, key, kind):
    if key not in record:
        raise Fail("%s: missing key %s" % (where, key))
    value = record[key]
    if kind is int:
        ok = isinstance(value, (int, float)) and not isinstance(value, bool)
    else:
        ok = isinstance(value, kind)
    if not ok:
        raise Fail("%s: key %s is %s, not %s" % (where, key, type(value).__name__, kind.__name__))
    return value


def text(record, where, key):
    """A string key that iOS leaves out of the archive when the text is empty
    (measured on the simulator: an empty body and an empty threadIdentifier
    have no key, an empty title keeps its key as "")."""
    return need(record, where, key, str) if key in record else ""


def number(value):
    return int(value) if float(value).is_integer() else value


def trigger_of(record, where):
    kind = need(record, where, "UNNotificationTriggerType", str)
    repeats = need(record, where, "TriggerRepeats", bool)
    if kind == "TimeInterval":
        seconds = need(record, where, "TriggerTimeInterval", int)
        return {"type": "interval", "seconds": number(seconds), "repeats": repeats}
    if kind == "Calendar":
        parts = need(record, where, "TriggerDateComponents", dict)
        if parts.get("$class") != "NSDateComponents":
            raise Fail("%s: TriggerDateComponents is class %s, not NSDateComponents"
                       % (where, parts.get("$class")))
        known = {"NS." + n for n in COMPONENTS + tuple(DATE_EXTRAS)} | {"$class"}
        for key in parts:
            if key not in known:
                raise Fail("%s: TriggerDateComponents has unknown key %s" % (where, key))
        for name, default in DATE_EXTRAS.items():
            if parts.get("NS." + name, default) != default:
                raise Fail("%s: TriggerDateComponents sets NS.%s, which this reader does not print"
                           % (where, name))
        out = {}
        for name in COMPONENTS:
            value = parts.get("NS." + name)
            if value is None:
                continue
            if isinstance(value, bool) or not isinstance(value, int):
                raise Fail("%s: date component %s is %s, not an integer"
                           % (where, name, type(value).__name__))
            if abs(value) < UNDEFINED:
                out[name] = value
        return {"type": "calendar", "dateComponents": out, "repeats": repeats}
    raise Fail("%s: unknown trigger class %s" % (where, kind))


def pending(root):
    if not isinstance(root, list):
        raise Fail("the pending archive's root is %s, not an array" % type(root).__name__)
    out = []
    for index, record in enumerate(root):
        where = "record %d" % index
        if not isinstance(record, dict):
            raise Fail("%s is %s, not a dict" % (where, type(record).__name__))
        identifier = need(record, where, "AppNotificationIdentifier", str)
        where = "record %d (%s)" % (index, identifier)
        out.append({
            "identifier": identifier,
            "title": need(record, where, "AppNotificationTitle", str),
            "body": text(record, where, "AppNotificationMessage"),
            "threadId": text(record, where, "SBSPushStoreNotificationThreadKey"),
            "trigger": trigger_of(record, where),
        })
    return sorted(out, key=lambda r: r["identifier"])


def load(path):
    try:
        with open(path, "rb") as f:
            return resolve(plistlib.load(f))
    except Fail as e:
        raise Fail("%s: %s" % (path, e))
    except (OSError, plistlib.InvalidFileException, ValueError, KeyError,
            IndexError, TypeError, AttributeError) as e:
        raise Fail("%s: unreadable archive (%s: %s)" % (path, type(e).__name__, e))


def main(argv):
    if len(argv) == 3 and argv[1] == "--raw":
        print(json.dumps(load(argv[2]), indent=1, sort_keys=True, default=str))
        return 0
    if len(argv) != 3:
        print("usage: pending.py USERNOTIFICATIONS_DIR BUNDLE | --raw FILE", file=sys.stderr)
        return 2
    base, bundle = Path(argv[1]), argv[2]
    library = base / "Library.plist"
    # A moved folder or a missing Library.plist is a format change, not an
    # app with nothing pending: [] needs a Library.plist that exists, and then
    # either a bundle missing from it or a folder with no pending file.
    if not base.is_dir():
        raise Fail("%s is not a directory" % base)
    if not library.is_file():
        raise Fail("%s does not exist" % library)
    folders = load(library)
    if not isinstance(folders, dict):
        raise Fail("%s: root is %s, not a dict" % (library, type(folders).__name__))
    folder = folders.get(bundle)
    if folder is None:
        print("sim: %s is not in %s: it has never been given notification settings, so nothing is pending"
              % (bundle, library), file=sys.stderr)
        print("[]")
        return 0
    if not isinstance(folder, str) or not folder or "/" in folder or folder.startswith("."):
        raise Fail("%s: folder for %s is %r" % (library, bundle, folder))
    file = base / folder / "PendingNotifications.plist"
    # Measured: an app's folder has no pending file until it first schedules,
    # so this is the usual state, but a renamed file would look the same.
    if not file.is_file():
        print("sim: %s does not exist: nothing has been scheduled since %s was installed"
              % (file, bundle), file=sys.stderr)
        print("[]")
        return 0
    records = pending(load(file))
    print(json.dumps(records, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except Fail as e:
        print("sim: pending: %s" % e, file=sys.stderr)
        sys.exit(1)
