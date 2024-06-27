async function getRequest(url) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: url,
      method: "GET",
      dataType: "text/html",
      success: function (res) {
        resolve(res);
      },
      error: function (err) {
        reject(err);
      },
    });
  });
}

async function delay(second) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, second);
  });
}
