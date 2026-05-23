===================================================
  AAYAM FILE SERVER - Setup Instructions
===================================================

FIRST TIME SETUP:
-----------------
1. Copy this entire folder to the Windows PC (192.168.1.200)
   - Example: C:\aayam-file-server\

2. Right-click setup.bat → "Run as Administrator"

3. It will automatically:
   - Check if Node.js is installed
   - Create C:\AayamFiles\ folder
   - Install server software
   - Set up auto-start on Windows boot
   - Start the server

4. Server runs at: http://192.168.1.200:3001
   Files saved to: C:\AayamFiles\


DAILY USE:
----------
- Server starts automatically when Windows boots
- Keep the server window open (do not close it)
- If accidentally closed, double-click start-server.bat


CHECKING SERVER STATUS:
-----------------------
Open any browser and go to:
http://192.168.1.200:3001/health

You should see server status, total files, and disk space.


FILE STORAGE:
-------------
Files are organised by job number:
C:\AayamFiles\
  JOB-001\
    design_file_1234567890.pdf
    artwork_1234567891.ai
  JOB-002\
    ...


SUPPORT:
--------
API Key: aayam-local-2025
Port: 3001
Max file size: 500 MB

===================================================
