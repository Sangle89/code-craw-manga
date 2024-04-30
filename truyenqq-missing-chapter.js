const SOURCE_URL = "https://truyenqqvn.com/tim-kiem-nang-cao/trang-[PAGE].html";
const BASE_API = "https://apis.mangatruyen.vn/api/crawler/v2";
const ALLOW_TYPE = ["image/png", "image/jpeg", "image/gif"];
async function getData(api) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: BASE_API + api,
      method: "GET",
      dataType: "json",
      success: function (res) {
        resolve(res);
      },
      error: function (err) {
        reject(err);
      },
    });
  });
}

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

async function postRequest(api, data) {
  return new Promise((resolve, reject) => {
    try {
      $.ajax({
        url: BASE_API + api,
        method: "POST",
        data: data,
        dataType: "json",
        success: function (res) {
          resolve(res);
        },
        error: function (err) {
          reject(err);
        },
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function delay(second) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, second);
  });
}

async function getImageBlob(url) {
  return await (await fetch(url)).blob();
}

const blobUrlToFile = async (blobUrl) =>
  new Promise((resolve) => {
    try {
      fetch(blobUrl, {
        headers: {
          Referer: "https://truyenqqvn.com/",
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

function getChapSlug(url) {
  return url.split("?")[0].split("/").pop().split(".")[0];
}

function isExist(data, value) {
  return !!data.find((item) => item.url === value);
}

async function getListChapter(book_url) {
  const html = await $.get(book_url);
  const chapters = [];
  let author;
  if (html) {
    $(html)
      .find(".works-chapter-item")
      .each(function (i, elem) {
        const name = $(elem).find(".name-chap a", 0);
        const time = $(elem).find(".time-chap", 0).text();
        if (!isExist(chapters, name.attr("href"))) {
          chapters.push({
            name: name.text(),
            url: name.attr("href"),
            created_date: time,
          });
        }
      });

    author = $(html).find("li.author .col-xs-9").text();
  }
  return { chapters: chapters.reverse(), author };
}

/**
 * Upload folder will like /data/book-slug/chapter-slug/filename.jpg
 */
async function uploadFile(book, chapter, blob, filename) {
  const f = new FormData();
  f.append("file", blob);
  f.append("filename", filename);
  f.append("book_id", book.id);
  f.append("book_slug", book.slug);
  f.append("chapter_slug", getChapSlug(chapter.url));
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
      error: function (err) {
        reject(err);
      },
    });
  });
}

async function saveNewBook({ blob, ...data }) {
  const f = new FormData();
  f.append("file", blob);
  for (const [key, value] of Object.entries(data)) {
    f.append(key, value);
  }
  return new Promise((resolve, reject) => {
    $.ajax({
      url: BASE_API + "/save-book",
      method: "POST",
      data: f,
      contentType: false,
      cache: false,
      processData: false,
      success: function (res) {
        resolve(res);
      },
      error: function (err) {
        reject(err);
      },
    });
  });
}

function filterImage(img) {
  return (
    !img.startsWith("https://puu.sh") &&
    !img.startsWith("https://delivery.adnetwork.vn")
  );
}

/**
 * book: {id, slug, name}
 * chapters: ["chapter-url",...]
 */
async function crawChapter(book, chapters) {
  let chapter_index = chapters[0]?.["chapter_index"] || 1;
  let i = 0;
  console.log("Start craw chapter");
  while (i < chapters.length) {
    console.log("Crawing ", chapters[i].url);
    const html = await $.get(chapters[i].url);
    if (html) {
      const images = [];
      $(html)
        .find("div.page-chapter")
        .each(function (i, elem) {
          let image = $(elem).find("img", 0);
          if (image && filterImage(image.attr("src"))) {
            images.push(image.attr("src"));
          }
        });

      if (images.length == 0) break;

      // Save chapter images
      await postRequest("/save-list-image-chapter", {
        book_slug: book.slug,
        chapter_index: i,
        chapter_slug: getChapSlug(chapters[i].url),
        images,
        is_last: i === chapters.length - 1,
      });

      // Get image blob and send to server
      let j = 0;
      while (j < images.length) {
        const _image = images[j].replace(
          "https://imgur.com/",
          "https://i.imgur.com/"
        );

        console.log("      => downloading: ", j + 1, "/", images.length);

        let blob = await blobUrlToFile(_image);
        if (blob === false) {
          let retry = setInterval(async function () {
            blob = await blobUrlToFile(_image);
            if (blob) {
              clearInterval(retry);
            }
          }, 5500);
        }

        if (blob) {
          const filename = images[j].split("?")[0].split("/").pop();
          const st = await uploadFile(
            book,
            chapters[i],
            blob,
            filename,
            chapter_index
          );
        }

        j++;
        chapter_index += 1;
        await delay(1000);
      }
    } else {
      console.error("Can not craw html content");
    }

    i++;
  }
}

async function _run(book) {
  localStorage.setItem("TRUYENQQ_PAGE", page);
  await crawChapter(book, [
    { slug: `https://truyenqqvn.com/truyen-tranh/${book.slug}-chap-1.html` },
  ]);
}

async function _start() {
  let lastBook = localStorage.getItem("TRUYENQQ_LAST_BOOK") ?? 1;
  let _start = lastBook === undefined ? true : false;

  const response = await $.get(BASE_API + "/get-book-empty");
  const books = response?.data || [];

  const max = books.length;
  let i = 0;
  while (i <= max) {
    if (!_start && books[i].slug == lastBook) {
      _start = true;
    }

    if (_start) {
      await _run(books[i]);
      await delay(500);
    }
    i++;
  }
}
