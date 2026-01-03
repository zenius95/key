const db = require('./models');

async function checkData() {
    try {
        const products = await db.Product.findAll({
            include: [{ model: db.Package, as: 'packages' }]
        });

        console.log(`Found ${products.length} products`);
        products.forEach(p => {
            console.log(`Product: ${p.id} - ${p.name} [${p.status}]`);
            if (p.packages) {
                console.log(`  Packages: ${p.packages.length}`);
                p.packages.forEach(pkg => {
                    console.log(`    - ID: ${pkg.id}, Name: ${pkg.name}, Original Price: ${pkg.original_price}, Max UIDs: ${pkg.max_uids}`);
                });
            } else {
                console.log('  No packages found (p.packages is null/undefined)');
            }
        });

        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkData();
