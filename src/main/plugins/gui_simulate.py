import sys
import time
import argparse
import os

try:
    from pynput.keyboard import Key, Controller
except ImportError:
    print("Error: pynput not installed")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--text', type=str, default="")
    parser.add_argument('--action', type=str, default="type") # "type", "keep-note", "exec-js"
    args = parser.parse_args()

    keyboard = Controller()
    
    # Wait a moment for window to focus
    time.sleep(1.2)

    is_mac = sys.platform == "darwin"

    if args.action == "keep-note":
        # Clear any search focus or dialogs
        keyboard.tap(Key.esc)
        time.sleep(0.4)
        
        # Open a new note modal
        keyboard.tap('c')
        time.sleep(0.6)
        
        # Separate title from body
        lines = args.text.split('\n', 1)
        if len(lines) > 1 and lines[0].strip():
            title = lines[0].strip()
            body = lines[1].strip()
        else:
            title = "Sentinel Note"
            body = args.text.strip()
            
        # Type Title
        for char in title:
            keyboard.type(char)
            time.sleep(0.01)
            
        time.sleep(0.3)
        
        # Press tab to focus the note body
        keyboard.tap(Key.tab)
        time.sleep(0.3)
        
        # Type Body
        for char in body:
            keyboard.type(char)
            time.sleep(0.01)
            
        time.sleep(0.4)
        
        # Press Escape to close and save
        keyboard.tap(Key.esc)
            
    elif args.action == "exec-js":
        # Open Developer Tools Console
        if is_mac:
            # Cmd + Option + J
            with keyboard.pressed(Key.cmd, Key.alt):
                keyboard.tap('j')
        else:
            # Ctrl + Shift + J
            with keyboard.pressed(Key.ctrl, Key.shift):
                keyboard.tap('j')
                
        time.sleep(1.0) # Wait for console to open

        # Paste the script (which is already set in clipboard by main process)
        if is_mac:
            with keyboard.pressed(Key.cmd):
                keyboard.tap('v')
        else:
            with keyboard.pressed(Key.ctrl):
                keyboard.tap('v')
                
        time.sleep(0.3)
        keyboard.tap(Key.enter)
        time.sleep(0.5)

        # Close Developer Tools Console
        if is_mac:
            with keyboard.pressed(Key.cmd, Key.alt):
                keyboard.tap('j')
        else:
            with keyboard.pressed(Key.ctrl, Key.shift):
                keyboard.tap('j')
                
    else:
        # Standard typing simulation
        for char in args.text:
            keyboard.type(char)
            time.sleep(0.01)

    print("Success")

if __name__ == "__main__":
    main()
