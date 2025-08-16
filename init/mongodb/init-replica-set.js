// Initialize MongoDB replica set for high availability
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongodb-primary:27017", priority: 1 }
  ]
});

// Wait for replica set to be ready
while (!rs.isMaster().ismaster) {
  sleep(1000);
}

// Create application database and users
db = db.getSiblingDB('constellation');

// Create application user
db.createUser({
  user: "constellation_user",
  pwd: "constellation_password", // Should be changed in production
  roles: [
    { role: "readWrite", db: "constellation" }
  ]
});

// Create collections with proper indexes
db.createCollection("projects");
db.createCollection("users");
db.createCollection("workspaces");
db.createCollection("chat_sessions");
db.createCollection("audit_logs");

// Create indexes for performance
db.projects.createIndex({ "id": 1 }, { unique: true });
db.projects.createIndex({ "name": 1 });
db.projects.createIndex({ "type": 1 });
db.projects.createIndex({ "status": 1 });
db.projects.createIndex({ "createdAt": -1 });
db.projects.createIndex({ "updatedAt": -1 });

db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 }, { unique: true });

db.workspaces.createIndex({ "projectId": 1 });
db.workspaces.createIndex({ "userId": 1 });

db.chat_sessions.createIndex({ "projectId": 1 });
db.chat_sessions.createIndex({ "userId": 1 });
db.chat_sessions.createIndex({ "createdAt": -1 });

db.audit_logs.createIndex({ "timestamp": -1 });
db.audit_logs.createIndex({ "userId": 1 });
db.audit_logs.createIndex({ "action": 1 });

print("MongoDB initialization completed successfully!");