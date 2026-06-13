import unittest
from unittest import mock

import requests

import update_data


def make_response(status_code=200, payload=None, json_error=None, text="", content_type="application/json"):
    response = mock.Mock()
    response.status_code = status_code
    response.headers = {"content-type": content_type}
    response.text = text
    response.raise_for_status.side_effect = requests.HTTPError(f"{status_code} error") if status_code >= 400 else None
    if json_error is not None:
        response.json.side_effect = json_error
    else:
        response.json.return_value = payload
    return response


class FetchCartoRowsTests(unittest.TestCase):
    @mock.patch("update_data.time.sleep", return_value=None)
    def test_retries_after_non_json_response(self, _sleep):
        session = mock.Mock()
        session.get.side_effect = [
            make_response(
                payload=None,
                json_error=requests.exceptions.JSONDecodeError("Expecting value", "", 0),
                text="",
                content_type="text/html",
            ),
            make_response(payload={"rows": [{"cartodb_id": 1, "status": "Open"}]}),
        ]

        result = update_data.fetch_carto_rows("SELECT 1", session=session, attempts=2, retry_delay=0)

        self.assertEqual(result.to_dict("records"), [{"cartodb_id": 1, "status": "Open"}])
        self.assertEqual(session.get.call_count, 2)

    @mock.patch("update_data.time.sleep", return_value=None)
    def test_raises_when_all_attempts_return_non_json(self, _sleep):
        session = mock.Mock()
        session.get.return_value = make_response(
            payload=None,
            json_error=requests.exceptions.JSONDecodeError("Expecting value", "", 0),
            text="Service Unavailable",
            content_type="text/html",
        )

        with self.assertRaises(update_data.UpstreamUnavailableError):
            update_data.fetch_carto_rows("SELECT 1", session=session, attempts=2, retry_delay=0)


if __name__ == "__main__":
    unittest.main()
