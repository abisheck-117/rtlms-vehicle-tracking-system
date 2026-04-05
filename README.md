# vehicle tracker

this is a simple vehicle tracking app. it shows live location updates on a map. the backend handles data and the frontend displays it.

## running the backend

1. open a terminal
2. go to the backend folder:

   cd backend

3. run the server:

   python manage.py runserver


backend runs on: http://127.0.0.1:8000


## running the frontend

no frameworks used, just plain html/css/js.

1. open another terminal
2. go to the frontend folder:
   cd frontend
3. start a simple server:
   python -m http.server 5500
4. open:
   http://127.0.0.1:5500

note: avoid using live server extensions, they tend to refresh when the database updates and can break things.

## simulating a vehicle

to test tracking:

1. add a vehicle from django admin (`/admin`)
2. copy the device api key
3. paste it into `hardware_simulator.py`
4. run:
   python hardware_simulator.py
this will keep sending location updates to the backend.

## notes

* backend and frontend run separately (different ports)
* firebase config is public (this is normal), access is controlled using rules
* sensitive files are ignored using `.gitignore`
* refer `.env.example` file for reference of sensitive files.