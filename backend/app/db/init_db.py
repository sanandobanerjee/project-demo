from app.db.database import Base,engine
from app.db import models

def init_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)