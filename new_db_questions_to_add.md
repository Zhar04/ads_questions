```json
"id": "DB-?",
"question": "Для следующей таблицы: Названия столбцов: ID, Name, Surname, GPA, COURSE. Ниже строки этой таблицы относительно столбцов выше: 1, Yerbol, Kazhigerey, 2.5, 3; 2, Aidana, Khassenova, 3, 2; 3, Marat, Aidosov, 4, 1; 4, Aidos, Kurmanov, 1.4, 4; 5, Elena, Fedorova, 2, 1; 6, Aidar, Elmanov, 3.1, 3; 7, Anna, Karenina, 2.1, 2. Выберите правильно написанные SQL запросы использующие group by",
"options": [
  {
    "letter": "A",
    "text": "SELECT COURSE, MIN(GPA) FROM STUDENTS GROUP BY COURSE;"
  },
  {
    "letter": "B",
    "text": "SELECT COURSE, WHICH(GPA) FROM STUDENTS GROUP BY COURSE;"
  },
  {
    "letter": "C",
    "text": "SELECT COURSE, MIN(GPA) FROM STUDENTS GROUPINGBY COURSE;"
  },
  {
    "letter": "D",
    "text": "SELECT COURSE, MAX(GPA) FROM STUDENTS GROUPING BY COURSE;"
  },
  {
    "letter": "E",
    "text": "SELECT COURSE, AVG(GPA) FROM STUDENTS GROUP BY COURSE;"
  },
  {
    "letter": "F",
    "text": "SELECT WHO(COURSE), MAX(GPA) FROM STUDENTS GROUP BY COURSE;"
  },
  {
    "letter": "G",
    "text": "SELECT WHICH(COURSE), MAX(GPA) FROM STUDENTS GROUP BY COURSE;"
  }
```

```json
"id": "DB-?",
"question": "Для следующей таблицы: Названия столбцов: ID, Name, Surname, GPA, COURSE. Ниже строки этой таблицы относительно столбцов выше: 1, Yerbol, Kazhigerey, 2.5, 3; 2, Aidana, Khassenova, 3, 2; 3, Marat, Aidosov, 4, 1; 4, Aidos, Kurmanov, 1.4, 4; 5, Elena, Fedorova, 2, 1; 6, Aidar, Elmanov, 3.1, 3; 7, Anna, Karenina, 2.1, 2. Выберите все результаты следующего SQL запроса: SELECT Name FROM Students WHERE ID=1 OR ID=2;",
"options": [
  {
    "letter": "A",
    "text": "Yerbol"
  },
  {
    "letter": "B",
    "text": "3"
  },
  {
    "letter": "C",
    "text": "Karenina"
  },
  {
    "letter": "D",
    "text": "Aidar"
  },
  {
    "letter": "E",
    "text": "5"
  },
  {
    "letter": "F",
    "text": "4"
  },
  {
    "letter": "G",
    "text": "Aidana"
  }
```

```json
"id": "DB-?",
"question": "Для того чтобы изменить данные в таблице используется команда",
"options": [
  {
    "letter": "A",
    "text": "CREATE"
  },
  {
    "letter": "B",
    "text": "UPDATE"
  },
  {
    "letter": "C",
    "text": "ATTACH"
  },
  {
    "letter": "D",
    "text": "ALTER"
  },
  {
    "letter": "E",
    "text": "DROP"
  },
  {
    "letter": "F",
    "text": "USE"
  }
```
