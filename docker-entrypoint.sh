#!/bin/bash
set -e

# Start a D-Bus session bus if not already running
if [ -z "$DBUS_SESSION_BUS_ADDRESS" ]; then
    eval $(dbus-launch --sh-syntax)
    export DBUS_SESSION_BUS_ADDRESS
fi

# Ensure the keyring directory exists
mkdir -p "$XDG_DATA_HOME/keyrings"

# Initialize gnome-keyring headlessly.
# We use an empty password to unlock/create the 'login' keyring.
# This allows keytar to store and retrieve secrets.
# We redirect output to avoid leaking sensitive environment variables to logs,
# though here the 'secret' is just an empty string.
eval $(echo "" | gnome-keyring-daemon --unlock --components=secrets)

# Export variables for the keyring daemon
export GNOME_KEYRING_CONTROL
export GNOME_KEYRING_PID

# Execute the main container command
exec "$@"
