const express = require("express")  
const cors = require('cors')        //  Cross-Origin Resource Sharing
const sqlite3 = require("sqlite3")  
const {open} = require("sqlite")    
const path = require("path")
const fetch = require("node-fetch");

//  join the database path
const databasePath = path.join(__dirname, 'ecomdata.db');

const app = express();

app.use(cors());        //middleware

// //  Initialize database
let db = null;
const PORT = 3000       // port 

const initializeDBandServer = async() =>{
    try{
        db = await open({
            filename: databasePath,
            driver: sqlite3.Database,
        });
        
        app.listen(PORT, () =>{
            console.log(`Server running on http://localhost:${PORT}/`)
        });
    }catch(error){
        console.log(`DB Error: ${error.message}`)
        process.exit(1)
    }
}

initializeDBandServer();


// define the path SQlite database file
const dbPath = path.resolve(__dirname, "ecomdata.db");

//  Create a new SQlite database connection
const DB = new sqlite3.Database(dbPath, (error) => {
    if(error){
        console.log('Error opening database:', error.message);
    }else{
        console.log('Connected to the SQLite database');
    }
});



//  Fetch Data from Third-Party API 
const url = 'https://s3.amazonaws.com/roxiler.com/product_transaction.json'

//  CREATE TABLE
const createTable = () => {
    return new Promise((resolve, reject) => {
        DB.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER,
            title TEXT,
            price FLOAT(2),
            description TEXT,
            category TEXT,
            image TEXT,
            sold BOOL,
            dateOfSale TEXT
        )`, (error) => {
            if (error) {
                console.log('Error creating table:', error.message);
                reject(error);
            } else {
                console.log('Table created successfully');
                resolve();
            }
        });
    });
};

//  INSERT DATA IN TABLE
const insertData = (product) => {
    return new Promise((resolve, reject) => {
        DB.run(`INSERT INTO products (id, title, price, description, category, image, sold, dateOfSale)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [product.id, product.title, product.price, product.description, product.category, product.image, product.sold, product.dateOfSale],
            (error) => {
                if (error) {
                    console.log('Error inserting data:', error.message);
                    reject(error);
                } else {
                    // console.log('Data Inserted Successfully');
                    resolve();
                }
            }
        );
    });
};

//  FETCH DATA TO LOCAL ecomdata.db AS TABLE
fetch(url)
    .then((response) => response.json())
    .then(async (data) => {
        try {
            // Create the 'products' table
            const tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='products'");
            if(!tableExists){
                await createTable();
                // Use Promise.all to wait for all INSERT operations to complete
                await Promise.all(data.map((product) => insertData(product)));
            }else{
                console.log('table already exists')
            }
            console.log('All data inserted successfully');
        } catch (error) {
            console.error('Error:', error.message);
        }
    });


//  FETCH DATA FROM THE TABLE
// app.get("/api/products/", async (request, response) =>{
//     try{                                        
//         const fetchDataFromTable = `SELECT * FROM products`;
//         const transactions = await db.all(fetchDataFromTable)
//         response.status(200).send(transactions)
//         console.log('filtered data created')
//     }catch(error){
//         response.status(500).send({success: false, message:'Error fetching Transactions'})
//         console.log(error)
//     }
// })

//  FILTER DATA BY MONTH, TITLE, DESCRIPTION, PRICE
app.get("/api/products/", async (request, response) => {
    try {
        const {month=0o3,search='',page=1,perPage=10} = request.query
        const filterData = `SELECT * FROM products WHERE strftime('%m',dateOfSale) = '${month}'
        AND (title LIKE '%${search}%' OR description LIKE '%${search}%' OR price LIKE '%${search}%')
        LIMIT ${perPage} OFFSET ${page} `;
        const results = await db.all(filterData);
        response.status(200).send(results);
        // console.log(results)
    } catch (error) {
        response.send(error.message)
        console.log('filter not working')
    }
})

//  STATISTICS API
app.get('/api/statistics/', async (request,response)=>{
    try{
        const {month} = request.query;

        const totalSaleAmount = `
        SELECT ROUND(SUM(price),2) AS price FROM products WHERE strftime('%m', dateOfSale) = ? `;
        const resultSaleAmount = await db.get(totalSaleAmount, [month]);
        
        const totalSoldItems = `
        SELECT COUNT(*) AS sold FROM products WHERE strftime('%m', dateOfSale) = ? AND sold = ?`;
        const resultSoldItems = await db.get(totalSoldItems, [month,1])

        const totalNotSoldItems =`
        SELECT COUNT(*) AS notSold FROM products WHERE strftime('%m', dateOfSale) = ? AND sold= ?`;
        const resultNotSoldItems = await db.get(totalNotSoldItems, [month,0]);
        
        response.send({totalSaleAmount: resultSaleAmount.price, totalSoldItems:resultSoldItems.sold, totalNotSoldItems: resultNotSoldItems.notSold})

    }catch(error){
        console.log(error)
        response.json({success: false, message: 'error fetching Statistics'})
    }
})


//  API FOR BAR CHART
app.get('/api/bar-chart/', async (request, response) => {
    try {
        const {month} = request.query;
        const filterBarChartData = `
        SELECT 
            CASE
                WHEN price BETWEEN 0 AND 100 THEN '0 - 100'
                WHEN price BETWEEN 101 AND 200 THEN '101 - 200'
                WHEN price BETWEEN 201 AND 300 THEN '201 - 300'
                WHEN price BETWEEN 301 AND 400 THEN '301 - 400'
                WHEN price BETWEEN 401 AND 500 THEN '401 - 500'
                WHEN price BETWEEN 501 AND 600 THEN '501 - 600'
                WHEN price BETWEEN 601 AND 700 THEN '601 - 700'
                WHEN price BETWEEN 701 AND 800 THEN '701 - 800'
                WHEN price BETWEEN 801 AND 900 THEN '801 - 900'
                ELSE '901-above'
            END AS priceRange,
            COUNT(*) AS itemCount
        FROM products
        WHERE
            strftime('%m', dateOfSale)= '${month}'
        GROUP BY 
            priceRange
        ORDER BY
            MIN(price)`;
        const resultBarChartData = await db.all(filterBarChartData);
        response.json({resultBarChartData})
        console.log('resultBarChartData')
        
    } catch (error) {
        response.json({success: false, message: 'error fetching bar-chart data'})
        console.log(error)
    }
})






const apiUrl1 = '/api/products/'    //  Filter data by month,title,description,price
const apiUrl2 = '/api/statistics/'  //  Statistics like totalAmount,soldItems,notSoldItems
const apiUrl3 = '/api/bar-chart/'   //  Bar-Chart Data


//  COMBAINED DATA API
app.get('/api/combined-data/', async (request, response)=>{
    try {
        const {month} = request.query;

        const transactionsResponse = await fetch(`http://localhost:${PORT}${apiUrl1}?month=${month}`);
        const StatisticsResponse = await fetch(`http://localhost:${PORT}${apiUrl2}?month=${month}`);
        const barChartResponse = await fetch(`http://localhost:${PORT}${apiUrl3}?month=${month}`);
        
        const transactionsJsonData = await transactionsResponse.json();
        const StatisticsJsonData = await StatisticsResponse.json();
        const barChartJsonData = await barChartResponse.json();

        response.json({
            transsactions: transactionsJsonData,
            statisticts: StatisticsJsonData,
            barChartData: barChartJsonData,
            
        })

    } catch (error) {
        response.json({success: false, message: "error combained data"})
        console.log(error)
    }
})