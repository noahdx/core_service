import { Router } from 'express';
import { authenticate } from '../../lib/auth/authenticate';
import { tokens } from '../../lib/di/tokens';
import { container } from '../../lib/di/container';
import { ProductController } from './controller/product.controller';
import { rbac, requireRestaurantMember } from '../../lib/auth/rbac';
import { cacheLayer } from '../../lib/cache/cache-layer';

export const productRouter = Router();

const productController = container.resolve<ProductController>(tokens.ProductController);

productRouter.get('/products/:id', productController.findById);
productRouter.get('/branches/:branchId/products', cacheLayer({ branchScoped: true }), productController.findByBranch);
productRouter.get(
  '/restaurants/:restaurantId/categories',
  cacheLayer({ restaurantScoped: true }),
  productController.findCategories,
);

productRouter.get(
  '/restaurants/:restaurantId/products',
  authenticate,
  requireRestaurantMember('restaurantId'),
  rbac({ resource: 'core:product', action: 'read' }),
  productController.findByRestaurant,
);

productRouter.patch(
  '/products/:id',
  authenticate,
  rbac({ resource: 'core:product', action: 'update' }),
  productController.update,
);

productRouter.post(
  '/restaurants/:restaurantId/products',
  authenticate,
  requireRestaurantMember('restaurantId'),
  rbac({ resource: 'core:product', action: 'create' }),
  productController.create,
);
