import sqlite3
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class OTPHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        try:
            # Connect to django db
            conn = sqlite3.connect('d:/rtlms/backend/db.sqlite3')
            cursor = conn.cursor()
            cursor.execute("SELECT otp_code FROM tracker_emailotp WHERE email='test3@gmail.com' ORDER BY created_at DESC LIMIT 1")
            row = cursor.fetchone()
            otp = row[0] if row else '000000'
            conn.close()
            
            response = json.dumps({'email_otp': otp})
            self.wfile.write(response.encode('utf-8'))
        except Exception as e:
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', 8001), OTPHandler)
    print("Serving OTPs on 8001")
    server.serve_forever()
