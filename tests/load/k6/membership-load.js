import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:3000";
const PROFILE = (__ENV.PROFILE || "baseline").toLowerCase();

const profiles = {
  baseline: {
    vus: 40,
    duration: "10m"
  },
  spike: {
    stages: [
      { duration: "2m", target: 30 },
      { duration: "1m", target: 300 },
      { duration: "4m", target: 300 },
      { duration: "2m", target: 40 }
    ]
  },
  stress: {
    stages: [
      { duration: "3m", target: 80 },
      { duration: "5m", target: 250 },
      { duration: "8m", target: 500 },
      { duration: "3m", target: 50 }
    ]
  },
  soak: {
    vus: 60,
    duration: "6h"
  }
};

export const options = {
  ...profiles[PROFILE],
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500", "p(99)<3000"]
  }
};

function postJson(path, body) {
  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), {
    headers: {
      "content-type": "application/json"
    }
  });
}

export default function () {
  const home = http.get(`${BASE_URL}/`);
  check(home, {
    "home status is healthy": (r) => r.status === 200
  });

  const join = http.get(`${BASE_URL}/join`);
  check(join, {
    "join status is healthy": (r) => r.status === 200
  });

  const track = postJson("/api/track", { event: "page_view", path: "/" });
  check(track, {
    "track endpoint responds": (r) => [200, 429].includes(r.status)
  });

  const otp = postJson("/api/membership/request-otp", {
    email: `load-${Math.floor(Math.random() * 100000)}@example.com`
  });
  check(otp, {
    "otp endpoint bounded": (r) => [200, 401, 422, 429, 503].includes(r.status)
  });

  const status = http.get(`${BASE_URL}/api/membership/status?subscriptionId=sub_k6_dummy`);
  check(status, {
    "status endpoint bounded": (r) => [200, 401, 422, 429].includes(r.status)
  });

  sleep(1);
}
