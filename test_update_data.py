import unittest
from unittest import mock

import pandas as pd
import requests

import update_data


def make_response(status_code=200, payload=None, json_error=None, text="", content_type="application/json"):
    response = mock.Mock()
    response.status_code = status_code
    response.headers = {"content-type": content_type}
    response.text = text
    response.raise_for_status.side_effect = requests.HTTPError(response=response) if 400 <= status_code < 500 else None
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

    @mock.patch("update_data.time.sleep", return_value=None)
    def test_retries_after_request_exception(self, _sleep):
        session = mock.Mock()
        session.get.side_effect = [
            requests.exceptions.ConnectionError("temporary failure"),
            make_response(payload={"rows": [{"cartodb_id": 2, "status": "Closed"}]}),
        ]

        result = update_data.fetch_carto_rows("SELECT 1", session=session, attempts=2, retry_delay=0)

        self.assertEqual(result.to_dict("records"), [{"cartodb_id": 2, "status": "Closed"}])
        self.assertEqual(session.get.call_count, 2)

    def test_raises_upstream_unavailable_on_http_400(self):
        session = mock.Mock()
        session.get.return_value = make_response(status_code=400)

        with self.assertRaises(update_data.UpstreamUnavailableError):
            update_data.fetch_carto_rows("SELECT 1", session=session, attempts=2, retry_delay=0)

        self.assertEqual(session.get.call_count, 1)

    @mock.patch("update_data.time.sleep", return_value=None)
    def test_retries_after_http_500(self, _sleep):
        session = mock.Mock()
        session.get.side_effect = [
            make_response(status_code=500),
            make_response(payload={"rows": [{"cartodb_id": 3, "status": "Open"}]}),
        ]

        result = update_data.fetch_carto_rows("SELECT 1", session=session, attempts=2, retry_delay=0)

        self.assertEqual(result.to_dict("records"), [{"cartodb_id": 3, "status": "Open"}])
        self.assertEqual(session.get.call_count, 2)


class BuildQueryTests(unittest.TestCase):
    def _get_query_for_latest_date(self, iso_str):
        """Return the Carto query that would be built for the given latest datetime string."""
        df = pd.DataFrame({
            "cartodb_id": [1],
            "requested_datetime": pd.to_datetime([iso_str], utc=True),
            "closed_datetime": [pd.NaT],
            "status": ["Open"],
            "status_notes": [""],
            "zipcode": ["19103"],
            "area": ["Center City"],
            "time_to_close": [pd.NA],
        })
        with mock.patch("pandas.read_csv", return_value=df):
            with mock.patch("update_data.fetch_carto_rows") as mock_fetch:
                mock_fetch.side_effect = SystemExit(0)
                try:
                    update_data.main()
                except SystemExit:
                    pass
                if mock_fetch.called:
                    return mock_fetch.call_args[0][0]
        return None

    def test_query_uses_iso_datetime_not_to_timestamp(self):
        query = self._get_query_for_latest_date("2026-05-21 21:07:23+00:00")
        self.assertIsNotNone(query)
        self.assertNotIn("to_timestamp", query)
        self.assertIn("2026-05-21", query)


if __name__ == "__main__":
    unittest.main()
