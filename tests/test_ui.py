import helloapp.app as app


def test_ui_main_callable():
    assert callable(app.main)
