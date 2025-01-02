from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash

def get_database():
    """
    Connect to MongoDB Atlas and return the database instance.
    """
    client = MongoClient("mongodb+srv://Doralaikon_th:Doralaikon_TH2025@cluster0.mongodb.net/?retryWrites=true&w=majority")
    db = client['admin_db']
    return db

def add_admin_user(username, password):
    """
    Add a new admin user to the database with a hashed password.
    """
    db = get_database()
    collection = db['admins']
    hashed_password = generate_password_hash(password)
    collection.insert_one({"username": username, "password": hashed_password})
    print("Admin user added successfully!")

def authenticate_user(username, password):
    """
    Check if the username and password match an admin user in the database.
    """
    db = get_database()
    collection = db['admins']
    user = collection.find_one({"username": username})
    if user and check_password_hash(user['password'], password):
        return True
    return False

# Example usage (replace with your actual credentials for testing):
if __name__ == "__main__":
    # Add a new admin user
    # add_admin_user("admin", "admin123")

    # Authenticate an admin user
    username = "admin"
    password = "admin123"
    if authenticate_user(username, password):
        print("Authentication successful!")
    else:
        print("Authentication failed!")
