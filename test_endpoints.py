import urllib.request
import json

def run_tests():
    base = "http://127.0.0.1:8000"
    print("Testing Smart Expense Tracker API Endpoints...")
    
    # 1. Test GET /api/db-status
    res = json.loads(urllib.request.urlopen(f"{base}/api/db-status").read().decode("utf-8"))
    print("[1/8] GET /api/db-status -> Engine:", res.get("engine"))

    # 2. Test POST /api/transactions (CREATE)
    payload = json.dumps({
        "title": "Automated Verification Test",
        "amount": 29.99,
        "type": "expense",
        "category": "Food",
        "date": "2026-10-12",
        "notes": "Testing CRUD operations"
    }).encode("utf-8")
    req = urllib.request.Request(f"{base}/api/transactions", data=payload, headers={"Content-Type": "application/json"}, method="POST")
    new_tx = json.loads(urllib.request.urlopen(req).read().decode("utf-8"))
    tx_id = new_tx["id"]
    print(f"[2/8] POST /api/transactions (CREATE) -> Created ID {tx_id}: {new_tx['title']} (${new_tx['amount']})")

    # 3. Test GET /api/transactions/{id} (READ)
    single = json.loads(urllib.request.urlopen(f"{base}/api/transactions/{tx_id}").read().decode("utf-8"))
    print(f"[3/8] GET /api/transactions/{tx_id} (READ) -> Fetched: {single['title']}")

    # 4. Test PUT /api/transactions/{id} (UPDATE)
    update_payload = json.dumps({"amount": 35.50, "notes": "Updated note during test"}).encode("utf-8")
    req_update = urllib.request.Request(f"{base}/api/transactions/{tx_id}", data=update_payload, headers={"Content-Type": "application/json"}, method="PUT")
    updated = json.loads(urllib.request.urlopen(req_update).read().decode("utf-8"))
    print(f"[4/8] PUT /api/transactions/{tx_id} (UPDATE) -> Updated amount to ${updated['amount']}")

    # 5. Test DELETE /api/transactions/{id} (DELETE)
    req_del = urllib.request.Request(f"{base}/api/transactions/{tx_id}", method="DELETE")
    del_res = json.loads(urllib.request.urlopen(req_del).read().decode("utf-8"))
    print(f"[5/8] DELETE /api/transactions/{tx_id} (DELETE) -> {del_res.get('message')}")

    # 6. Test GET /api/charts (CHARTS)
    charts = json.loads(urllib.request.urlopen(f"{base}/api/charts").read().decode("utf-8"))
    print(f"[6/8] GET /api/charts -> Categories: {len(charts['pie_chart']['labels'])}, Dates: {len(charts['daily_timeline']['dates'])}")

    # 7. Test Export CSV
    csv_bytes = urllib.request.urlopen(f"{base}/api/export/csv").read()
    print(f"[7/8] GET /api/export/csv -> Exported CSV size: {len(csv_bytes)} bytes")

    # 8. Test Export JSON
    json_bytes = urllib.request.urlopen(f"{base}/api/export/json").read()
    print(f"[8/8] GET /api/export/json -> Exported JSON size: {len(json_bytes)} bytes")

    print("\nALL 8 SYSTEM CHECKS PASSED WITH 100% SUCCESS!\n")

if __name__ == "__main__":
    run_tests()
