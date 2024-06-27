const ALLOW_TYPE = ["image/png", "image/jpeg", "image/gif"];
const DOMAIN = "https://truyenqqviet.com/truyen";
!(function (a) {
  "function" == typeof define && define.amd
    ? define(["jquery"], a)
    : a("object" == typeof exports ? require("jquery") : jQuery);
})(function (a) {
  function b(b, c) {
    var d = c.times,
      e = b.timeout;
    return function (f) {
      function g() {
        a.ajax(h)
          .retry({
            times: d - 1,
            timeout: c.timeout,
            statusCodes: c.statusCodes,
          })
          .pipe(i.resolve, i.reject);
      }
      var h = this,
        i = new a.Deferred(),
        j = b.getResponseHeader("Retry-After");
      return (
        d > 1 && (!b.statusCodes || a.inArray(f.status, b.statusCodes) > -1)
          ? (j &&
              ((e = isNaN(j)
                ? new Date(j).getTime() - a.now()
                : 1e3 * parseInt(j, 10)),
              (isNaN(e) || 0 > e) && (e = b.timeout)),
            void 0 !== e ? setTimeout(g, e) : g())
          : i.rejectWith(this, arguments),
        i
      );
    };
  }
  a.ajaxPrefilter(function (a, c, d) {
    d.retry = function (a) {
      return (
        a.timeout && (this.timeout = a.timeout),
        a.statusCodes && (this.statusCodes = a.statusCodes),
        this.pipe(null, b(this, a))
      );
    };
  });
});
async function getRequest(url) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: url,
      method: "GET",
      //dataType: "application/json",
      success: function (res) {
        resolve(res);
      },
      //   error: function (err) {
      //     reject(err);
      //   },
    });
  });
}

async function delay(second) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, second * 1000);
  });
}

const blobUrlToFile = async (blobUrl) =>
  new Promise((resolve) => {
    try {
      fetch(blobUrl, {
        headers: {
          Referer: "https://truyenqqviet.com/",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36",
          Accept:
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      })
        .then((res) => {
          res.blob().then((blob) => {
            if (ALLOW_TYPE.includes(blob.type)) {
              const file = new File([blob], "image.jpg", { type: blob.type });
              resolve(file);
            } else {
              resolve(false);
            }
          });
        })
        .catch((err) => {
          console.log(JSON.stringify(err));
          resolve(false);
        });
    } catch (err) {
      resolve(false);
    }
  });

async function uploadFile(book, chapter_slug, blob, filename) {
  const f = new FormData();
  f.append("file", blob);
  f.append("filename", filename);
  f.append("book_id", book.id);
  f.append("book_slug", book.slug_origin);
  f.append("chapter_slug", chapter_slug);
  return new Promise((resolve, reject) => {
    $.ajax({
      url: BASE_API + "/save-image-chapter",
      method: "POST",
      data: f,
      contentType: false,
      cache: false,
      processData: false,
      success: function (res) {
        resolve(res);
      },
      // error: function (err) {
      //   reject(err);
      // },
    })
      .retry({ times: 3, statusCodes: [503, 504, 520] })
      .then(function () {});
  });
}

const BASE_API = "https://apis.mangatruyen.vn/api/crawler/v2";

const skip = localStorage.getItem("__SKIP");
let current = skip ? Number(skip) : 23;
let list_chapters = [];
async function start() {
  localStorage.setItem("__SKIP", current);
  const book = await getRequest(BASE_API + "/get-book?skip=" + current);
  current = book.current;
  list_chapters = book.list_chapters;
  let i = 0;
  console.log(book.book.slug_origin + ` (${list_chapters.length}) chap`);
  while (i < list_chapters.length) {
    const chapter = await getRequest(
      BASE_API +
        "/get-chapter?book_slug=" +
        book.book.slug_origin +
        "&chap_slug=" +
        list_chapters[i].slug
    );

    // Chapter image
    const { chapters } = chapter;
    console.log(
      "====== " + list_chapters[i].slug + ` (${chapters.length} images)`
    );
    let j = 0;
    while (j < chapters.length) {
      const _image = chapters[j].replace(
        "https://imgur.com/",
        "https://i.imgur.com/"
      );
      console.log(`============= ${j} / ${chapters.length}`);
      let blob = await blobUrlToFile(_image);

      if (blob) {
        const filename = chapters[j].split("?")[0].split("/").pop();
        await uploadFile(book.book, list_chapters[i].slug, blob, filename, i);
      }

      j++;
      //   chapter_index += 1;
      await delay(1);
    }

    await delay(1);
    i++;
  }

  current++;
  await delay(1);
  start();
}

start();
