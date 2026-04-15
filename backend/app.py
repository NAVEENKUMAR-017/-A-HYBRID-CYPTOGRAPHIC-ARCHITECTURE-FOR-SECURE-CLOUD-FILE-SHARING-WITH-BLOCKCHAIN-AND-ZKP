"""
app.py
-------
Flask application factory for Secure File Share backend.
"""

import os
from flask      import Flask, jsonify
from flask_cors import CORS
from dotenv     import load_dotenv

from routes.files import files_bp
from routes.share import share_bp
from routes.keys  import keys_bp
from routes.audit import audit_bp

load_dotenv()


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = os.getenv("FLASK_SECRET_KEY", "rAboWDH/oMT/wuyya0izGp3uybpGcrC6e+R79rrd")

    # CORS — allow React dev server
    CORS(app, resources={r"/api/*": {"origins": [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]}})

    # Register blueprints
    app.register_blueprint(files_bp)
    app.register_blueprint(share_bp)
    app.register_blueprint(keys_bp)
    app.register_blueprint(audit_bp)

    # Health check
    @app.route("/health")
    def health():
        from blockchain import BlockchainAudit
        try:
            chain   = BlockchainAudit()
            chain_ok = chain.is_connected()
        except Exception:
            chain_ok = False

        return jsonify({
            "status":            "ok",
            "blockchain":        "connected" if chain_ok else "disconnected",
            "cognito_pool":      os.getenv("COGNITO_USER_POOL_ID", "not set"),
            "s3_bucket":         os.getenv("S3_BUCKET_NAME", "not set"),
        })

    return app


if __name__ == "__main__":
    app  = create_app()
    port = int(os.getenv("FLASK_PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=(os.getenv("FLASK_ENV") == "development"))
