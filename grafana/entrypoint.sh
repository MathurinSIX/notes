#!/bin/sh
set -e

# Substitute __POSTGRES_SCHEMA__ in provisioning files (dashboards, alerts, etc.)
# Match backend/app/core/db.py: identifiers with hyphens must be double-quoted in SQL.
SCHEMA="${POSTGRES_SCHEMA:-public}"

# Escape for sed s|...|REPL|g replacement: & and \ are special in the replacement text.
escape_sed_repl() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/&/\\&/g'
}

subst_schema_in_file() {
  f="$1"
  case "$SCHEMA" in
    *-*)
      esc_json=$(printf '%s' "$SCHEMA" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
      esc_json=$(escape_sed_repl "$esc_json")
      sed -i "s|__POSTGRES_SCHEMA__|\\\\\"${esc_json}\\\\\"|g" "$f"
      ;;
    *)
      safe=$(escape_sed_repl "$SCHEMA")
      sed -i "s|__POSTGRES_SCHEMA__|${safe}|g" "$f"
      ;;
  esac
}

for dir in /etc/grafana/provisioning/dashboards /etc/grafana/provisioning/alerting; do
  [ -d "$dir" ] || continue
  for f in "$dir"/*.json "$dir"/*.yaml; do
    [ -f "$f" ] || continue
    subst_schema_in_file "$f"
  done
done

exec /run.sh "$@"
