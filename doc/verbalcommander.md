# Плагин verbalcommander

Плагин принимает текстовые (словесные) команды в виде строки на языке интерфейса, формирует команды управления устройствами или команды на запуск сценариев для сервера и ответ в текстовом виде.

=> **Включи верхний свет в гараже**   --Обработка-- => **plugin.do('LAMP200', 'on')** - команда на сервер
                                                    => **Гараж. Верхний свет включен** - ответ клиенту                                            
## Механизм распознавания текстовых команд 

Плагин загружает списки устройств и названий сценариев с сервера и строит частотный словарь с набором ключевых слов.

При разборе фразы выполняется поиск ключевых слов по частотному словарю (начиная с наиболее редко встречающегося слова) Входящая фраза может содержать лишние слова, порядок слов значения не имеет. 
Для русского языка обрабатываются окончания. Для совпадения требуется наличие во фразе всех ключевых слов команды.

Например, набор ключевых слов "гараж включить верхний свет": 

=> **стемнело пора включать верхний свет в гараже** 
=> **Але гараж включи верхний свет** 
=> **Домовой, в гараже верхний свет включай быстрей** 

Все фразы будут распознаны c результатом:  **Гараж. Верхний свет включен** 

Текущая версия плагина формирует только команды Включить-Выключить для устройств и групповых операций. 
В дальнейшем планируется расширить набор команд, добавив возможность управления аналоговыми актуаторами (команды Увеличить-Уменьшить яркость, громкость, и т д), а также индивидуальную настройку для устройства.

Для сценариев ключевые слова строятся из названия.


## Формирование ключевых слов управления устройствами

Плагин загружает список устройств (актуаторов) с сервера, включая названия уровней и помещений. Для голосового управления важно, как называются ваши устройства.

Наборы ключевых слов формируются по следующему принципу:

* Если название устройства уникально (например, у вас один кондиционер в проекте), то ключевым набором будет просто **включи кондиционер**.

* Все слова из названия устройства (кроме тех что в скобках) считаются ключевыми
Например, если устройство называется "Подсветка зеркала (точечный светильник)", то ключевым набором будет не **включи подсветку**, а **включи подсветку зеркала**. 

* Если кондиционеров несколько, но вы назвали их по разному, например, "Большой кондиционер" и  "Малый кондиционер", то есть название уникально, ключевыми наборами будут  **включи большой кондиционер** и **включи малый кондиционер**

* Если кондиционеров несколько, все называются просто "кондиционер" и определены помещения, где они находятся, то наборы будут **гостиная включи кондиционер**, **спальня включи кондиционер**. 

* Наконец, если определен только уровень, но не помещение, ключевым набором будет **1 этаж включи кондиционер**. 

Также есть вероятность, что совпадает название помещения на разных уровнях, например, спальни на 1 и 2 этаже. Тогда в ключевой набор включаются и помещение и уровень: **спальня 1 этаж включи кондиционер**

Естественно вы всегда можете упоминать в команде и уровень, и помещение. Просто это обычно не является необходимым. В ответ всегда включаются и уровень и помещение, если они для устройства определены.

Например: 
=> **включи точечные светильники**  
<= **Мансарда Зимний сад. Точечные светильники включены**


## Формирование ключевых слов для групповых команд

Плагин автоматически формирует групповые команды для управления светом.

Для каждого помещения/уровня формируются команды "<место> включи свет" и  "<место> выключи свет"
Команда распространяется на устройства с типами "Светильник", "Диммер","Светильник RGB"

Например:
 **выключи свет на кухне** - для помещения Кухня
 **выключи свет на территории** - для уровня Территории
 **спальня 1 этаж выключи свет** - спальня есть на 1 и 2 этаже - нужно указать этаж








