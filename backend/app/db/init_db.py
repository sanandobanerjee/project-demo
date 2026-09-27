from app.db.database import Base,engine
from app.db import models

def init_db():
    Base.metadata.create_all(bind=engine)