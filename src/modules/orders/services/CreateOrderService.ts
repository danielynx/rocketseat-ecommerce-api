import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }

    if (!products) {
      throw new AppError("The 'products' parameter wasn't sended");
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    if (existentProducts.length !== products.length) {
      throw new AppError('Product not found');
    }

    const ordersProducts = existentProducts.map(({ id, quantity, price }) => {
      const product = products.find(
        productSearched => productSearched.id === id,
      );

      if (!product) {
        throw new AppError(`Product (${id}) not found`);
      }

      if (quantity < product.quantity) {
        throw new AppError(
          `Product (${id}) amount insufficient to provide the amount requested`,
        );
      }

      return {
        product_id: id,
        quantity: product.quantity,
        price,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: ordersProducts,
    });

    const productsQuantity = order.order_products.map(
      ({ product_id, quantity }) => {
        const existentProduct = existentProducts.find(
          productSearched => productSearched.id === product_id,
        );

        if (!existentProduct) {
          throw new AppError(`Product (${product_id}) not found`);
        }

        return {
          id: product_id,
          quantity: existentProduct.quantity - quantity,
        };
      },
    );

    await this.productsRepository.updateQuantity(productsQuantity);

    return order;
  }
}

export default CreateOrderService;
