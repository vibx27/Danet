import { Reflect } from "https://deno.land/x/reflect_metadata@v0.1.12-2/mod.ts";
import { ControllerConstructor } from '../router/controller/constructor.ts';
import { InjectableConstructor } from '../injectable/constructor.ts';
import { dependencyInjectionMetadataKey, SCOPE } from '../injectable/decorator.ts';
import { ModuleConstructor } from '../module/constructor.ts';
import { moduleMetadataKey } from '../module/decorator.ts';
import { Constructor } from '../utils/constructor.ts';

export class Injector {
  private resolved = new Map<Constructor, () => unknown>();
  private availableTypes: InjectableConstructor[] = [];
  public get<T>(Type: Constructor<T>): T {
    if (this.resolved.has(Type))
      return this.resolved.get(Type)!() as T;
    throw Error('type not injected');
  }

  public bootstrap(ModuleType: ModuleConstructor) {
      const { controllers, injectables } = Reflect.getMetadata(moduleMetadataKey, ModuleType);
      this.availableTypes = this.availableTypes.concat(...injectables);
      this.registerInjectables(injectables);
      this.resolveControllers(controllers);
  }

  public registerInjectables(Injectables: InjectableConstructor[]) {
    Injectables?.forEach((Provider: InjectableConstructor) => {
      this.prepareInjectable(Provider);
    });
  }

  public resolveControllers(Controllers: ControllerConstructor[]) {
    Controllers?.forEach((Controller: ControllerConstructor) => {
      this.resolveControllerDependencies(Controller)
    })
  }

  private resolveControllerDependencies<T>(Type: Constructor<T>) {
    const dependencies = this.getDependencies(Type);
    dependencies.forEach((DependencyType) => {
      if (!this.resolved.has(DependencyType))
        throw new Error(`${Type.name} dependency ${DependencyType.name} is not available in injection context. Did you provide it in module ?`);
    });
    this.resolved.set(Type, () => new Type(...dependencies.map((Dep) => this.resolved.get(Dep)!())))
  }

  private prepareInjectable(Type: InjectableConstructor) {
    this.resolveInjectable(Type);
  }

  private resolveInjectable(Type: InjectableConstructor) {
    const dependencies = this.getDependencies(Type);
    this.resolveDependencies(dependencies);
    const injectableMetadata = Reflect.getOwnMetadata(dependencyInjectionMetadataKey, Type);
    if (injectableMetadata?.scope === SCOPE.GLOBAL) {
      const instance = new Type(...dependencies.map((Dep) => this.resolved.get(Dep)!()));
      this.resolved.set(Type, () => instance);
    } else {
      this.resolved.set(Type, () => new Type(...dependencies.map((Dep) => this.resolved.get(Dep)!())));
    }
  }

  private resolveDependencies(Types: Constructor[]) {
    Types.forEach((Type) => {
      if (!this.resolved.get(Type)) {
        if (this.availableTypes.includes(Type)) {
          this.resolveInjectable(Type);
        } else {
          throw new Error(`${Type.name} is not available in injection context. Did you provide it in module ?`);
        }
      }
    })
  }

  private getDependencies(Type: Constructor): Constructor[] {
    return Reflect.getOwnMetadata("design:paramtypes", Type) || [];
  }
}
