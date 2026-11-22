# ХимЛаб

ХимЛаб — учебная веб-лаборатория. В ней можно смешивать реагенты, разглядывать колбы в 3D и наблюдать выделение газа, образование осадка и изменение окраски индикатора.

## Запуск

В папке проекта выполните:

```powershell
python -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Откройте [лабораторию на localhost](http://127.0.0.1:8765/). Готовый сайт находится в каталоге `dist`. Сборка и запросы к CDN для работы симулятора не требуются. Для доступа с телефона разместите `dist` на HTTPS-хостинге.

## Режимы работы

- В обычном режиме колбу можно поворачивать, приближать и разворачивать на весь экран.
- В WebXR колбу можно разместить на поверхности. Выбор реагентов и запуск опыта доступны прямо в AR-интерфейсе. Нужен браузер с поддержкой immersive AR, hit-test и DOM overlay.
- Если WebXR недоступен, кнопка AR включает наложение трёхмерной колбы на видео с камеры. Колба остаётся привязана к экрану. Камере нужен безопасный контекст (HTTPS или localhost) и разрешение браузера. Видео обрабатывается в браузере.
- В каталоге шесть сценариев. Воду с капустным индикатором можно смешать отдельно как контроль. Для остальных пар, не описанных в каталоге, приложение показывает отсутствие данных.
- Журнал хранит до 50 наблюдений в локальном хранилище браузера. Анимации иллюстрируют качественные признаки реакций. Цвета, объём жидкости и темп анимаций условны.

## Источники и модели

- [American Chemical Society: газ и образование осадка](https://www.acs.org/middleschoolchemistry/lessonplans/chapter6/lesson3.html)
- [American Chemical Society: пищевая сода и лимонная кислота](https://www.acs.org/education/resources/k-8/inquiryinaction/fifth-grade/chapter-3/different-substances-react-differently.html)
- [American Chemical Society: капустный индикатор](https://www.acs.org/education/activities/red-cabbage-indicator.html)
- [University of Colorado Boulder: осадок карбоната кальция](https://www.colorado.edu/lab/lecture-demo-manual/general-reactions/s130-chemical-rxns-precipitation-cacl2-na2co3-caco3)
- [Innerscene: колба Эрленмейера (CC0)](https://www.innerscene.com/tools/library/3d-parts/erlenmeyer-flask-98edc983). В симуляции оригинальная жидкость удалена из модели и заменена анимированной.
- [Innerscene: круглодонная колба на штативе (CC0)](https://www.innerscene.com/tools/library/3d-parts/round-bottom-flask-with-stand-19d50771). Из файла выделена колба, без штатива и исходной жидкости.

Модель по умолчанию строится процедурно. Используются Three.js (MIT) и Manrope (SIL OFL). Лицензии находятся рядом с файлами библиотек и шрифта.

