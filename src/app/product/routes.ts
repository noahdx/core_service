import { Router } from 'express';
import { authenticate } from '../../lib/auth/authenticate';
import { tokens } from '../../lib/di/tokens';
import { container } from '../../lib/di/container';
import { ProductController } from './controller/product.controller';

export const productRouter = Router();

const productController = container.resolve<ProductController>(tokens.ProductController);

productRouter.get('/products/:id', productController.findById);
productRouter.get('/branches/:branchId/products', productController.findByBranch);
productRouter.patch('/products/:id', authenticate, productController.update);
productRouter.get('/restaurants/:restaurantId/categories', productController.findCategories);
productRouter.get('/restaurants/:restaurantId/products', authenticate, productController.findByRestaurant);
productRouter.post('/restaurants/:restaurantId/products', authenticate, productController.create);
